// @ts-expect-error missing types definition file
import objectScan from 'object-scan';
import type { TreeSelectionKeys } from 'primevue/tree';
import type { ImapFolderCursor } from '~/types/mining';
import { FolderStatus } from '~/types/enums';

export type { ImapFolderCursor } from '~/types/mining';

export interface BoxNode {
  key: string;
  label: string;
  total: number;
  cursor?: ImapFolderCursor;
  /** Persisted watermark, returned by getImapBoxes. */
  watermark?: { uidvalidity: string; last_uid: number };
  /** Sync status computed server-side by getImapBoxes. */
  status?: FolderStatus;
  has_new_messages?: boolean;
  latest_uid?: number | null;
  children?: BoxNode[];
  attribs?: string[];
}

const EXCLUDED_FOLDERS_FROM_DEFAULT = [
  'mailspring',
  'outbox',
  'drafts',
  'junk',
  'trash',
  '\\drafts',
  '\\junk',
  '\\trash',
];

const EXCLUDED_ATTRIBS_FROM_SELECTION = ['\\Noselect'];

/**
 * Gets default selected folders from the input boxes based on email service
 * @param boxes - The array of folder names to filter
 * @returns The filtered array of boxes and a set of excluded boxes keys
 */
export function getDefaultAndExcludedFolders(boxes: BoxNode[]) {
  const defaultFolders: TreeSelectionKeys = {};
  let foundAllMailKey: string | null = null;
  const excludedKeys = new Set<string>();

  objectScan(['**.key'], {
    joined: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filterFn: ({ parent }: any) => {
      const { key, attribs } = parent;
      const folder = key.split('/');
      const folderName = folder.pop();
      const folderParent = folder.pop();
      const isAllMail = attribs?.includes('\\All');

      if (
        attribs &&
        EXCLUDED_ATTRIBS_FROM_SELECTION.some((attrib) =>
          attribs.includes(attrib),
        )
      ) {
        excludedKeys.add(key);
      }

      if (foundAllMailKey && !isAllMail) return;

      const isExcluded = [...(attribs ?? []), folderName, folderParent]
        .filter(Boolean)
        .map((name) => name.toLowerCase())
        .some((name) => EXCLUDED_FOLDERS_FROM_DEFAULT.includes(name));

      if (isExcluded) return;

      const checked = attribs && !attribs.includes('\\HasChildren');
      const partialChecked = !checked;
      const isNoSelect = Boolean(attribs?.includes('\\Noselect')) || undefined;

      if (isAllMail && !isNoSelect) {
        // Clear previous selections
        // skipcq: JS-0320
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        Object.keys(defaultFolders).forEach((k) => delete defaultFolders[k]);
        // Add All Mail as checked
        defaultFolders[key] = {
          checked: true,
          partialChecked: false,
          isNoSelect,
        };
        foundAllMailKey = key;

        // Also mark parent folders as partially checked
        const pathParts = key.split('/');
        while (pathParts.length > 0) {
          pathParts.pop(); // remove current
          const parentKey = pathParts.join('/');
          if (parentKey in defaultFolders) continue;
          defaultFolders[parentKey] = {
            checked: false,
            partialChecked: true,
          };
        }
      } else {
        defaultFolders[key] = {
          checked,
          partialChecked,
        };
      }
    },
  })(boxes);

  return { defaultFolders, excludedKeys };
}

/** Persisted per-folder watermark from `config.mining.last.folders`. */
export interface FolderWatermark {
  uidvalidity: string;
  last_uid: number;
}

/**
 * Extracts the persisted per-folder watermark from a raw mining source config.
 * Only the typed V1 path (`config.mining.last.folders`) is read; legacy configs
 * simply produce no watermark and fall back to a full scan.
 * Mirrors `backend/src/utils/helpers/imapTreeHelpers.ts`.
 */
export function extractFolderWatermarks(
  rawConfig?: unknown,
): Record<string, FolderWatermark> {
  const folders = (
    rawConfig as
      | { mining?: { last?: { folders?: Record<string, unknown> } } }
      | undefined
  )?.mining?.last?.folders;

  if (!folders || typeof folders !== 'object') return {};

  const watermarks: Record<string, FolderWatermark> = {};
  for (const [folder, value] of Object.entries(folders)) {
    const candidate = value as
      | { uidvalidity?: unknown; last_uid?: unknown }
      | undefined;
    if (
      typeof candidate?.uidvalidity === 'string' &&
      Number.isInteger(candidate.last_uid) &&
      (candidate.last_uid as number) >= 0
    ) {
      watermarks[folder] = {
        uidvalidity: candidate.uidvalidity,
        last_uid: candidate.last_uid as number,
      };
    }
  }
  return watermarks;
}

/**
 * The single decision function for a folder's sync state: the live IMAP cursor
 * vs the persisted watermark. Mirrors `buildFolderStatus` in
 * `backend/src/utils/helpers/imapTreeHelpers.ts` (minus `requiresFullScan`,
 * which the tree never displays).
 */
export function buildFolderStatus({
  cursor,
  watermark,
}: {
  cursor?: ImapFolderCursor;
  watermark?: FolderWatermark;
}): { status: FolderStatus; hasNewMessages: boolean } {
  if (!watermark) {
    return { status: FolderStatus.Unmined, hasNewMessages: false };
  }

  const validWatermark =
    typeof watermark.uidvalidity === 'string' &&
    watermark.uidvalidity.length > 0 &&
    Number.isInteger(watermark.last_uid) &&
    watermark.last_uid >= 0;
  if (!validWatermark) {
    return { status: FolderStatus.UidvalidityChanged, hasNewMessages: false };
  }

  if (
    !cursor ||
    cursor.uidvalidity === null ||
    cursor.high_water_uid === null
  ) {
    return { status: FolderStatus.MetadataUnavailable, hasNewMessages: false };
  }

  if (cursor.uidvalidity !== watermark.uidvalidity) {
    return { status: FolderStatus.UidvalidityChanged, hasNewMessages: false };
  }

  const hasNewMessages = cursor.high_water_uid > watermark.last_uid;
  return {
    status: hasNewMessages ? FolderStatus.NewMessages : FolderStatus.UpToDate,
    hasNewMessages,
  };
}

/**
 * Re-derives watermark flags on EXISTING tree nodes from freshly fetched source
 * config watermarks (`config.mining.last.folders` keyed by folder path).
 *
 * Mutates nodes in place so selection, expansion, and counts are preserved —
 * only `watermark`, `status`, and `has_new_messages` are touched, and only on
 * nodes that have a fresh watermark entry. Nodes without one (unmined folders,
 * the synthetic root with key `''`) are left untouched.
 *
 * @returns the number of nodes updated.
 */
export function refreshBoxWatermarks(
  nodes: BoxNode[],
  watermarks: Record<string, FolderWatermark>,
): number {
  if (!nodes || nodes.length === 0) return 0;
  if (!watermarks || Object.keys(watermarks).length === 0) return 0;

  let updated = 0;
  const visit = (list: BoxNode[]) => {
    for (const node of list) {
      const watermark = node.key !== '' ? watermarks[node.key] : undefined;
      if (watermark) {
        node.watermark = {
          uidvalidity: watermark.uidvalidity,
          last_uid: watermark.last_uid,
        };
        const { status, hasNewMessages } = buildFolderStatus({
          cursor: node.cursor,
          watermark: node.watermark,
        });
        node.status = status;
        node.has_new_messages = hasNewMessages;
        updated += 1;
      }
      if (node.children?.length) visit(node.children);
    }
  };
  visit(nodes);
  return updated;
}
