import type {
  MiningSource,
  MiningSourceConfig,
  SourceHealth,
} from '~/types/mining';

export interface MiningSourceConfigFlags {
  extract_signatures: boolean;
  cleaning_enabled: boolean;
  google_contacts_sync: boolean;
}

export interface DerivedSourceState {
  state: 'active' | 'needs_reauth' | 'error';
  lastRunAt?: string;
  lastError?: string[];
  /** Folders with a persisted UID watermark (used for resume-vs-full). */
  minableFolders: string[];
  /** Highest UID mined per folder (from the last good run). */
  watermark?: Record<string, { uidvalidity: string; last_uid: number }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Folds the legacy top-level config keys (status, needs_reauth, last_run,
 * errors, folders_mined, mining_id, ...) into the namespaced V1 shape so the
 * UI reads one canonical shape whether a row was written pre- or post-migration.
 */
function normalizeConfig(raw?: unknown): MiningSourceConfig {
  const source = isRecord(raw) ? { ...raw } : {};

  // Legacy top-level keys folded into namespaced flags/health/mining. Unknown
  // keys not in this set (e.g. a future backend-compat key, or
  // passive_mining_toggled_off_at) are carried forward so read-merge-write
  // never destroys them.
  const LEGACY_KEYS = new Set<string>([
    'status',
    'last_run',
    'errors',
    'error',
    'needs_reauth',
    'folders_mined',
    'mining_id',
    'cleaning_enabled',
    'extract_signatures',
    'google_contacts_sync',
  ]);

  const health = (
    isRecord(source.health) ? { ...source.health } : {}
  ) as SourceHealth;

  if (source.needs_reauth === true) {
    // Authoritative: an explicit re-auth flag always wins.
    health.state = 'needs_reauth';
  } else if (health.state === undefined && typeof source.status === 'string') {
    // Fold legacy status only when no explicit namespaced health.state exists.
    if (source.status === 'completed') health.state = 'active';
    if (source.status === 'failed' || source.status === 'retrying') {
      health.state = 'error';
    }
  }
  if (typeof source.last_run === 'string' && !health.last_run_at) {
    health.last_run_at = source.last_run;
  }
  if (Array.isArray(source.errors) && !health.last_error) {
    health.last_error = source.errors.filter(
      (e): e is string => typeof e === 'string',
    );
  }

  const flags = isRecord(source.flags) ? { ...source.flags } : {};
  if (typeof source.cleaning_enabled === 'boolean') {
    flags.cleaning_enabled = source.cleaning_enabled;
  }
  if (typeof source.extract_signatures === 'boolean') {
    flags.extract_signatures = source.extract_signatures;
  }
  if (typeof source.google_contacts_sync === 'boolean') {
    flags.google_contacts_sync = source.google_contacts_sync;
  }

  const mining = isRecord(source.mining) ? { ...source.mining } : {};
  const last = isRecord(mining.last) ? { ...mining.last } : {};

  if (Array.isArray(source.folders_mined) && !last.folders_mined) {
    last.folders_mined = source.folders_mined.filter(
      (f): f is string => typeof f === 'string',
    );
  }
  if (source.mining_id !== undefined && last.mining_id === undefined) {
    last.mining_id = source.mining_id as string;
  }

  const folders = Array.isArray(source.folders)
    ? source.folders.filter((f): f is string => typeof f === 'string')
    : undefined;

  const result: MiningSourceConfig = {
    version: 1,
    ...(Object.keys(flags).length > 0 ? { flags } : {}),
    ...(folders ? { folders } : {}),
    ...(Object.keys(health).length > 0 ? { health } : {}),
    ...(Object.keys(mining).length > 0 || Object.keys(last).length > 0
      ? {
          mining: {
            ...mining,
            ...(Object.keys(last).length > 0 ? { last } : {}),
          },
        }
      : {}),
  };

  // Carry forward any unknown top-level keys so writes never drop them.
  for (const [key, value] of Object.entries(source)) {
    if (!(key in result) && !LEGACY_KEYS.has(key)) {
      result[key] = value as never;
    }
  }

  return result;
}

/** Reads typed config from a source (normalizing legacy rows). */
export function readSourceConfig(
  source?: MiningSource | MiningSourceConfig | null,
): MiningSourceConfig {
  return normalizeConfig(source && 'config' in source ? source.config : source);
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
  const normalized = normalizeConfig(config);
  const flags = normalized.flags ?? {};
  return {
    extract_signatures: flags.extract_signatures === true,
    cleaning_enabled: flags.cleaning_enabled !== false,
    google_contacts_sync: flags.google_contacts_sync === true,
  };
}

/**
 * Derives the durable source health + resume data used by the sources UI:
 * state badge, last run time, last error, and the folder watermarks available
 * for "continue from last message".
 */
export function deriveSourceState(source?: MiningSource): DerivedSourceState {
  const normalized = readSourceConfig(source);
  const health = normalized.health ?? {};

  const last = normalized.mining?.last ?? null;
  const watermark = last?.folders
    ? Object.fromEntries(
        Object.entries(last.folders).map(([folder, wm]) => [
          folder,
          { uidvalidity: wm.uidvalidity, last_uid: wm.last_uid },
        ]),
      )
    : undefined;

  return {
    state: health.state ?? (source?.passive_mining ? 'active' : 'active'),
    lastRunAt: health.last_run_at ?? undefined,
    lastError: health.last_error ?? undefined,
    minableFolders: watermark ? Object.keys(watermark) : [],
    watermark,
  };
}
