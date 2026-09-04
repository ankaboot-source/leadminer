import type { MiningSource } from '~/types/mining';

export interface MiningSourceConfigFlags {
  extract_signatures: boolean;
  cleaning_enabled: boolean;
  google_contacts_sync: boolean;
}

/**
 * Pure derivation of run-time mining flags from a source's persisted config.
 * The DB config is the single source of truth; these defaults mirror the
 * passive-mining backend defaults (cleaning true, extract false, gcs false).
 * With no config (or no active source) the defaults are returned.
 */
export function deriveSourceConfig(
  config?: MiningSource['config'],
): MiningSourceConfigFlags {
  return {
    extract_signatures: config?.extract_signatures === true,
    cleaning_enabled: config?.cleaning_enabled !== false,
    google_contacts_sync: config?.google_contacts_sync === true,
  };
}
