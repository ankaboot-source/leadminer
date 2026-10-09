import type { MiningTaskGroup } from '~/types/mining';

/**
 * Reads the passive runs out of a `GET /imap/mine/:userId/` response.
 *
 * That endpoint answers `204 No Content` when nothing is running, so the
 * response arrives empty rather than carrying empty arrays. Treating that as
 * "keep whatever we had" left the last finished run on screen indefinitely,
 * which is what the /sources progress chip renders from.
 */
export function normalizePassiveMinings(
  response?: {
    passive?: Array<MiningTaskGroup | undefined> | null;
  } | null,
): MiningTaskGroup[] {
  return (response?.passive ?? []).filter(
    (group): group is MiningTaskGroup => group !== undefined && group !== null,
  );
}
