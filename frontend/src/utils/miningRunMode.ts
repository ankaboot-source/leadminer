import type { MiningRunMode } from '~/types/mining';

/** Minimal storage surface so the logic is testable without a DOM. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY_PREFIX = 'leadminer:force-full-mining:';

export function forceFullMiningKey(email?: string): string {
  return `${KEY_PREFIX}${(email ?? '').trim().toLowerCase()}`;
}

/**
 * Whether the user explicitly opted out of resume for this source. Resume is
 * the default; only an explicit opt-out forces a full re-mine.
 */
export function readForceFullMining(
  email: string | undefined,
  storage: StorageLike | null | undefined = globalThis.localStorage,
): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(forceFullMiningKey(email)) === 'true';
  } catch {
    return false;
  }
}

export function writeForceFullMining(
  email: string | undefined,
  value: boolean,
  storage: StorageLike | null | undefined = globalThis.localStorage,
): void {
  if (!storage) return;
  try {
    storage.setItem(forceFullMiningKey(email), String(value));
  } catch {
    // Private mode / quota: the preference simply isn't persisted.
  }
}

/**
 * Resume by default: when a source has watermarks the store builds `resumeFrom`
 * for the selected folders. An explicit opt-out switches to a full re-mine.
 */
export function resolveMiningRunMode(forceFull: boolean): MiningRunMode {
  return forceFull ? 'full' : 'incremental';
}
