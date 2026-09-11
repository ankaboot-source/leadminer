import type {
  ImapFolderCursor,
  MiningFolderState,
  MiningFolderResumeWatermark,
  MiningFolderWatermark,
} from '~/types/mining';

export interface FolderState {
  state: MiningFolderState;
  hasNewMessages: boolean;
  requiresFullScan: boolean;
}

export interface ResumeCursor {
  folders: Record<string, { uidvalidity: string; last_uid: number }>;
}

type SupportedWatermark = MiningFolderWatermark | MiningFolderResumeWatermark;

function isValidWatermark(
  watermark: SupportedWatermark | undefined,
): watermark is SupportedWatermark {
  return Boolean(
    watermark &&
    typeof watermark.uidvalidity === 'string' &&
    watermark.uidvalidity.length > 0 &&
    Number.isInteger(watermark.last_uid) &&
    watermark.last_uid >= 0,
  );
}

/**
 * Resolves a folder's current mailbox cursor against its last successful run.
 * `high_water_uid` is intentionally treated as an upper bound: IMAP UIDs can
 * have gaps, so this function never reports an exact message count.
 */
export function resolveMiningFolderState(
  cursor: ImapFolderCursor | undefined,
  watermark?: SupportedWatermark,
): FolderState {
  if (!watermark) {
    return { state: 'unmined', hasNewMessages: false, requiresFullScan: false };
  }

  if (!isValidWatermark(watermark)) {
    return {
      state: 'uidvalidity_changed',
      hasNewMessages: false,
      requiresFullScan: true,
    };
  }

  if (
    !cursor ||
    cursor.uidvalidity === null ||
    cursor.high_water_uid === null
  ) {
    return {
      state: 'metadata_unavailable',
      hasNewMessages: false,
      requiresFullScan: false,
    };
  }

  if (cursor.uidvalidity !== watermark.uidvalidity) {
    return {
      state: 'uidvalidity_changed',
      hasNewMessages: false,
      requiresFullScan: true,
    };
  }

  const hasNewMessages = cursor.high_water_uid > watermark.last_uid;
  return {
    state: hasNewMessages ? 'new_messages' : 'up_to_date',
    hasNewMessages,
    requiresFullScan: false,
  };
}

/**
 * Builds an incremental resume cursor only for selected folders whose mailbox
 * identity still matches the persisted UID namespace. Other selected folders
 * are deliberately omitted and will use a full scan.
 */
export function buildSelectedResumeCursor(
  selectedFolders: Iterable<string>,
  cursors: Record<string, ImapFolderCursor | undefined>,
  watermarks:
    | Record<string, MiningFolderResumeWatermark | MiningFolderWatermark>
    | undefined,
): ResumeCursor | undefined {
  if (!watermarks) return undefined;

  const folders: ResumeCursor['folders'] = {};
  for (const folder of selectedFolders) {
    const watermark = watermarks[folder];
    const cursor = cursors[folder];
    const state = resolveMiningFolderState(cursor, watermark);
    if (
      watermark &&
      (state.state === 'up_to_date' || state.state === 'new_messages')
    ) {
      folders[folder] = {
        uidvalidity: watermark.uidvalidity,
        last_uid: watermark.last_uid,
      };
    }
  }

  return Object.keys(folders).length > 0 ? { folders } : undefined;
}
