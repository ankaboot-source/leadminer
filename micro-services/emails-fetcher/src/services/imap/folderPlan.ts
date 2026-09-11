import buildUidRanges from './uidRanges';

export type FolderPlanKind = 'uid-resume' | 'since' | 'full' | 'skip';

/**
 * How the run's outcome may influence the persisted UID watermark for a folder.
 * - `advance`: the scan covered an exact, contiguous UID window (full mailbox or
 *   `[last_uid+1 .. uidNext-1]`), so its max observed UID is a safe watermark.
 * - `preserve-or-omit`: the scan was date-filtered (`search since`) and cannot
 *   prove a contiguous mined prefix, so the cursor must not advance. Keep the
 *   previous cursor when the namespace still matches, otherwise omit the folder
 *   so the next run performs an exact full scan.
 */
export type WatermarkPolicy = 'advance' | 'preserve-or-omit';

export type SkipReason = 'empty' | 'no-matches';

export interface FolderResumeCursor {
  uidvalidity: string;
  last_uid: number;
}

export interface FolderPlanInput {
  folder: string;
  /** Mailbox EXISTS at open time. */
  exists: number;
  /** Mailbox UIDVALIDITY at open time (imapflow reports BigInt). */
  uidValidity?: bigint | number | null;
  /** Next UID the server will assign at open time. */
  uidNext?: number | null;
  resume?: FolderResumeCursor;
  /** Date fallback (first run / legacy / uidNext unavailable). */
  since?: string;
  chunkSize: number;
  /**
   * Injected `SEARCH SINCE` (returns UIDs). The caller MUST invoke this while
   * the mailbox is still open; the planner only marshals the result into ranges.
   */
  searchUids?: (since: Date) => Promise<number[] | undefined>;
}

export interface FolderPlan {
  folder: string;
  kind: FolderPlanKind;
  ranges: string[];
  /** True when `ranges` are UID ranges (vs sequence ranges). */
  useUid: boolean;
  watermarkPolicy: WatermarkPolicy;
  reason?: SkipReason;
}

function normalizeValidity(
  value: bigint | number | null | undefined
): string | undefined {
  if (value === undefined || value === null) return undefined;
  return String(value);
}

/**
 * Sequence ranges for a full mailbox scan. Mirrors the historical behavior:
 * a mailbox that fits one chunk is fetched with the `1:*` shorthand.
 */
export function buildSequenceRanges(
  total: number,
  chunkSize = 10000
): string[] {
  if (!Number.isFinite(total) || total <= 0) return [];
  if (total <= chunkSize) return ['1:*'];

  const ranges: string[] = [];
  let start = 1;
  while (start <= total) {
    const end = Math.min(start + chunkSize - 1, total);
    ranges.push(`${start}:${end}`);
    start = end + 1;
  }
  return ranges;
}

/** Chunks a sorted UID list into inclusive `first:last` ranges. */
function chunkUidList(uids: number[], chunkSize: number): string[] {
  const ranges: string[] = [];
  for (let start = 0; start < uids.length; start += chunkSize) {
    const end = Math.min(start + chunkSize - 1, uids.length - 1);
    ranges.push(`${uids[start]}:${uids[end]}`);
  }
  return ranges;
}

function skip(
  folder: string,
  reason: SkipReason,
  watermarkPolicy: WatermarkPolicy
): FolderPlan {
  return {
    folder,
    kind: 'skip',
    reason,
    ranges: [],
    useUid: false,
    watermarkPolicy
  };
}

/**
 * Pure decision function for how to fetch one folder.
 *
 * Precedence:
 *   1. empty mailbox             -> skip(empty), recordable identity (advance, 0)
 *   2. usable UID cursor          -> uid-resume (exact window)
 *   3. `since` provided           -> since (date fallback, non-advancing)
 *   4. otherwise                  -> full mailbox scan
 *
 * Strategy variants (uid-resume / since / full / skip) are selected here rather
 * than by nested branching in the transport class, and `searchUids` is injected
 * so the search can be performed while the mailbox is open and unit-tested.
 */
export async function planFolderFetch(
  input: FolderPlanInput
): Promise<FolderPlan> {
  const {
    folder,
    exists,
    uidValidity,
    uidNext,
    resume,
    since,
    chunkSize,
    searchUids
  } = input;

  if (!Number.isFinite(exists) || exists <= 0) {
    return skip(folder, 'empty', 'advance');
  }

  const liveValidity = normalizeValidity(uidValidity);
  const cursorUsable =
    resume !== undefined &&
    Number.isInteger(resume.last_uid) &&
    resume.last_uid >= 0 &&
    liveValidity !== undefined &&
    String(resume.uidvalidity) === liveValidity;

  if (cursorUsable && typeof uidNext === 'number' && uidNext > 0) {
    return {
      folder,
      kind: 'uid-resume',
      ranges: buildUidRanges(resume.last_uid + 1, uidNext - 1, chunkSize),
      useUid: true,
      watermarkPolicy: 'advance'
    };
  }

  if (since) {
    const searchDate = new Date(since);
    searchDate.setHours(0, 0, 0, 0);
    const uids = await searchUids?.(searchDate);
    if (!Array.isArray(uids) || uids.length === 0) {
      return skip(folder, 'no-matches', 'preserve-or-omit');
    }
    return {
      folder,
      kind: 'since',
      ranges: chunkUidList(uids, chunkSize),
      useUid: true,
      watermarkPolicy: 'preserve-or-omit'
    };
  }

  return {
    folder,
    kind: 'full',
    ranges: buildSequenceRanges(exists, chunkSize),
    useUid: false,
    watermarkPolicy: 'advance'
  };
}

export default planFolderFetch;
