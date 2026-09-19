import type { WatermarkPolicy } from './folderPlan';
import type {
  FolderWatermark,
  ImapResumeCursor,
  ImapWatermarkCursor
} from './types';

export interface WatermarkBuildInput {
  /** uidvalidity observed per folder during this run. */
  uidValidityPerFolder: ReadonlyMap<string, string>;
  /** Highest UID streamed per folder during this run. */
  maxUidPerFolder: ReadonlyMap<string, number>;
  /** Mailbox EXISTS observed at open time, per folder. */
  messageCountPerFolder: ReadonlyMap<string, number>;
  /** Planner decision per folder (see WatermarkPolicy). */
  watermarkPolicyPerFolder: ReadonlyMap<string, WatermarkPolicy>;
  resumeFrom?: ImapResumeCursor;
  /** Injected for deterministic tests. */
  updatedAt?: string;
}

/**
 * Builds the next per-folder watermark from a run's observations.
 *
 * Invariant (at-least-once): only `advance` policies — exact full or UID-range
 * scans, and empty folders — may move `last_uid`. A date-filtered `since` scan
 * is `preserve-or-omit`: it keeps the previous cursor when the UID namespace
 * still matches, and otherwise omits the folder so the next run performs an
 * exact full scan. This prevents skipping messages whose UID/date order is not
 * monotonic.
 */
export function buildWatermarkCursor(
  input: WatermarkBuildInput
): ImapWatermarkCursor | undefined {
  const {
    uidValidityPerFolder,
    maxUidPerFolder,
    messageCountPerFolder,
    watermarkPolicyPerFolder,
    resumeFrom
  } = input;
  const updatedAt = input.updatedAt ?? new Date().toISOString();
  const folders: Record<string, FolderWatermark> = {};

  for (const [folder, uidValidity] of uidValidityPerFolder) {
    const resume = resumeFrom?.folders?.[folder];
    const sameNamespace =
      resume !== undefined && String(resume.uidvalidity) === uidValidity;
    const previous = sameNamespace ? Math.max(0, resume.last_uid) : 0;
    const policy = watermarkPolicyPerFolder.get(folder) ?? 'preserve-or-omit';

    if (policy === 'preserve-or-omit') {
      if (sameNamespace) {
        folders[folder] = {
          uidvalidity: uidValidity,
          last_uid: previous,
          updated_at: updatedAt
        };
      }
      continue;
    }

    const lastUid = maxUidPerFolder.get(folder);
    folders[folder] = {
      uidvalidity: uidValidity,
      last_uid: Math.max(previous, lastUid ?? 0),
      total_messages: messageCountPerFolder.get(folder) ?? 0,
      updated_at: updatedAt
    };
  }

  return Object.keys(folders).length === 0 ? undefined : { folders };
}

export default buildWatermarkCursor;
