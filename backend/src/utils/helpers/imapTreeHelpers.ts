import { ListResponse } from 'imapflow';
import { FolderStatus } from '../../db/types';
import {
  FlatTree,
  FolderStatusInfo,
  FolderWatermark,
  ImapFolderCursor,
  ImapTreeRoot
} from '../../services/imap/types';

function normalizeCursor(status: ListResponse['status']): ImapFolderCursor {
  const uidValidity = status?.uidValidity;
  const uidNext = status?.uidNext;
  const uidvalidity =
    uidValidity === undefined || uidValidity === null
      ? null
      : String(uidValidity);
  const uidnext =
    typeof uidNext === 'number' && Number.isInteger(uidNext) && uidNext > 0
      ? uidNext
      : null;

  return {
    uidvalidity,
    uidnext,
    high_water_uid: uidnext === null ? null : Math.max(0, uidnext - 1)
  };
}

/**
 * Extracts the persisted per-folder watermark from a raw mining source config.
 * Only the typed V1 path (`config.mining.last.folders`) is read; legacy configs
 * simply produce no watermark and fall back to a full scan.
 */
export function extractFolderWatermarks(
  rawConfig: unknown
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
        last_uid: candidate.last_uid as number
      };
    }
  }
  return watermarks;
}

export interface BuildFolderStatusInput {
  cursor?: ImapFolderCursor;
  watermark?: FolderWatermark;
}

/**
 * The single decision function for a folder's sync state: the live IMAP cursor
 * vs the persisted watermark. Mirrors the rules that used to live in the
 * frontend (`miningFolderState.ts`), now computed where the boxes are fetched.
 */
export function buildFolderStatus({
  cursor,
  watermark
}: BuildFolderStatusInput): FolderStatusInfo {
  if (!watermark) {
    return {
      status: FolderStatus.Unmined,
      hasNewMessages: false,
      requiresFullScan: false
    };
  }

  const validWatermark =
    typeof watermark.uidvalidity === 'string' &&
    watermark.uidvalidity.length > 0 &&
    Number.isInteger(watermark.last_uid) &&
    watermark.last_uid >= 0;
  if (!validWatermark) {
    return {
      status: FolderStatus.UidvalidityChanged,
      hasNewMessages: false,
      requiresFullScan: true
    };
  }

  if (
    !cursor ||
    cursor.uidvalidity === null ||
    cursor.high_water_uid === null
  ) {
    return {
      status: FolderStatus.MetadataUnavailable,
      hasNewMessages: false,
      requiresFullScan: false
    };
  }

  if (cursor.uidvalidity !== watermark.uidvalidity) {
    return {
      status: FolderStatus.UidvalidityChanged,
      hasNewMessages: false,
      requiresFullScan: true
    };
  }

  const hasNewMessages = cursor.high_water_uid > watermark.last_uid;
  return {
    status: hasNewMessages ? FolderStatus.NewMessages : FolderStatus.UpToDate,
    hasNewMessages,
    requiresFullScan: false
  };
}

/**
 * Builds the `resumeFrom` map the emails-fetcher expects (`last_uid` per
 * folder), from a raw mining source config. Returning `undefined` means
 * "nothing to resume" so the fetcher does a full scan. The fetcher owns all
 * remaining IMAP logic (uidvalidity checks, ranges, fallback, watermark emit).
 */
export function buildResumeFromConfig(
  rawConfig: unknown
):
  | { folders: Record<string, { uidvalidity: string; last_uid: number }> }
  | undefined {
  const watermarks = extractFolderWatermarks(rawConfig);
  const folders: Record<string, { uidvalidity: string; last_uid: number }> = {};
  for (const [folder, watermark] of Object.entries(watermarks)) {
    folders[folder] = {
      uidvalidity: watermark.uidvalidity,
      last_uid: watermark.last_uid
    };
  }
  return Object.keys(folders).length > 0 ? { folders } : undefined;
}

export function createFlatTreeFromImap(
  boxes: ListResponse[],
  watermarks: Record<string, FolderWatermark> = {}
): FlatTree[] {
  const pathMap = new Map<string, FlatTree>();

  // Create FlatTree nodes without linking parents yet
  for (const box of boxes) {
    const cursor = normalizeCursor(box.status);
    const watermark = watermarks[box.path];
    const { status, hasNewMessages } = buildFolderStatus({ cursor, watermark });

    pathMap.set(box.path, {
      label: box.name,
      key: box.path,
      total: box.status?.messages || 0,
      cumulativeTotal: box.status?.messages || 0,
      attribs: Array.from(box.flags.values()),
      cursor,
      ...(watermark ? { watermark } : {}),
      status,
      has_new_messages: hasNewMessages,
      latest_uid: cursor.high_water_uid
    });
  }

  // Assign parent references
  for (const box of boxes) {
    const node = pathMap.get(box.path);
    if (node && box.parentPath && pathMap.has(box.parentPath)) {
      node.parent = pathMap.get(box.parentPath);
    }
  }

  return [...pathMap.values()];
}

/**
 * @param flatTree - A flat array of objects to build a tree.
 * @param userEmail - The email address of the user you want to get the data for.
 */

export function buildFinalTree(
  flatTree: FlatTree[],
  userEmail: string
): ImapTreeRoot[] {
  const readableTree: FlatTree[] = [];
  let totalInEmail = 0;

  for (const box of flatTree) {
    box.key = box.key.toString();

    if (box.parent) {
      if (box.parent.children) {
        box.parent.children.push(box);
      } else {
        box.parent.children = [box];
      }
      box.parent.cumulativeTotal! += box.total!;
    } else {
      readableTree.push(box);
    }
    totalInEmail += box.total!;
    delete box.parent;
  }

  return [
    {
      label: userEmail,
      children: [...readableTree],
      total: totalInEmail,
      key: ''
    }
  ];
}
