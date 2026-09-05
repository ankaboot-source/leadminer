// Shared MiningSourceConfig contract (Deno mirror of
// backend/src/services/mining-source-config). Kept dependency-light so both
// mining-sources and passive-mining can parse/normalize persisted config the
// same way the backend does.
import { z } from "zod";

export const SOURCE_HEALTH_STATES = [
  "active",
  "needs_reauth",
  "error",
] as const;
export type SourceHealthState = (typeof SOURCE_HEALTH_STATES)[number];

export const FOLDER_WATERMARK_SCHEMA = z.object({
  uidvalidity: z.string(),
  last_uid: z.number().int().nonnegative(),
  updated_at: z.string(),
});
export type FolderWatermark = z.infer<typeof FOLDER_WATERMARK_SCHEMA>;

export const MINING_COMPLETION_SCHEMA = z
  .object({
    mining_id: z.string().nullish(),
    mined_count: z.number().int().nonnegative().optional(),
    folders_mined: z.array(z.string()).optional(),
    updated_at: z.string().optional(),
    folders: z.record(z.string(), FOLDER_WATERMARK_SCHEMA).optional(),
  })
  .passthrough();
export type MiningCompletion = z.infer<typeof MINING_COMPLETION_SCHEMA>;

export const SOURCE_HEALTH_SCHEMA = z.object({
  state: z.enum(SOURCE_HEALTH_STATES).optional(),
  last_error: z.array(z.string()).nullable().optional(),
  last_run_at: z.string().nullable().optional(),
});
export type SourceHealth = z.infer<typeof SOURCE_HEALTH_SCHEMA>;

export const MINING_SOURCE_FLAGS_SCHEMA = z.object({
  cleaning_enabled: z.boolean().optional(),
  extract_signatures: z.boolean().optional(),
  google_contacts_sync: z.boolean().optional(),
});
export type MiningSourceFlags = z.infer<typeof MINING_SOURCE_FLAGS_SCHEMA>;

export const MINING_SOURCE_CONFIG_V1_SCHEMA = z
  .object({
    version: z.literal(1).optional(),
    flags: MINING_SOURCE_FLAGS_SCHEMA.passthrough().optional(),
    folders: z.array(z.string()).nullable().optional(),
    health: SOURCE_HEALTH_SCHEMA.passthrough().optional(),
    mining: z
      .object({
        last: MINING_COMPLETION_SCHEMA.passthrough().nullable().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type MiningSourceConfigV1 = z.infer<
  typeof MINING_SOURCE_CONFIG_V1_SCHEMA
>;

const LEGACY_STATE_KEYS = new Set<string>([
  "status",
  "last_run",
  "errors",
  "error",
  "needs_reauth",
  "folders_mined",
  "mining_id",
  "cleaning_enabled",
  "extract_signatures",
  "google_contacts_sync",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function legacyStatusToState(status: unknown): SourceHealthState | undefined {
  if (status === "completed") return "active";
  if (status === "failed" || status === "retrying") return "error";
  return undefined;
}

function asIsoString(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((v): v is string => typeof v === "string");
  return strings.length > 0 ? strings : undefined;
}

/** Folds legacy top-level config keys into the namespaced V1 shape. */
export function normalizeConfig(raw: unknown): Record<string, unknown> {
  const source = isRecord(raw) ? { ...raw } : {};

  const health: Record<string, unknown> = isRecord(source.health)
    ? { ...source.health }
    : {};

  if (source.needs_reauth === true) {
    // Authoritative — an explicit re-auth flag always wins.
    health.state = "needs_reauth";
  } else if (health.state === undefined && source.status !== undefined) {
    // Fold legacy status only when the config doesn't already carry a
    // namespaced health.state (a stale legacy `status` written by older
    // writers must not overwrite a newer explicit state).
    const state = legacyStatusToState(source.status);
    if (state) health.state = state;
  }
  if (source.last_run !== undefined) {
    const iso = asIsoString(source.last_run);
    if (iso) health.last_run_at = iso;
  }
  const legacyErrors =
    asStringArray(source.errors) ??
    (typeof source.error === "string" ? [source.error] : undefined);
  if (legacyErrors) health.last_error = legacyErrors;

  const flags = isRecord(source.flags) ? { ...source.flags } : {};
  for (const key of [
    "cleaning_enabled",
    "extract_signatures",
    "google_contacts_sync",
  ] as const) {
    if (typeof source[key] === "boolean") flags[key] = source[key];
  }

  const mining = isRecord(source.mining) ? { ...source.mining } : {};
  const lastMined = isRecord(mining.last) ? { ...mining.last } : {};
  const foldersMined = asStringArray(source.folders_mined);
  if (foldersMined) lastMined.folders_mined = foldersMined;
  if (source.mining_id !== undefined) lastMined.mining_id = source.mining_id;
  if (lastMined.updated_at === undefined) {
    const iso = asIsoString(source.last_run);
    if (iso) lastMined.updated_at = iso;
  }

  const folders = Array.isArray(source.folders)
    ? source.folders.filter((f): f is string => typeof f === "string")
    : undefined;

  const normalized: Record<string, unknown> = {
    version: 1,
    ...(Object.keys(flags).length > 0 ? { flags } : {}),
    ...(folders ? { folders } : {}),
    ...(Object.keys(health).length > 0 ? { health } : {}),
  };

  if (Object.keys(lastMined).length > 0 || Object.keys(mining).length > 0) {
    normalized.mining = {
      ...mining,
      last:
        Object.keys(lastMined).length > 0 ? lastMined : (mining.last ?? null),
    };
  }

  for (const [key, value] of Object.entries(source)) {
    if (!(key in normalized) && !LEGACY_STATE_KEYS.has(key)) {
      normalized[key] = value;
    }
  }

  return normalized;
}

/** Parses+validates a persisted config value into the typed V1 shape. */
export function parseConfig(raw: unknown): MiningSourceConfigV1 {
  const parsed = MINING_SOURCE_CONFIG_V1_SCHEMA.safeParse(normalizeConfig(raw));
  if (parsed.success) return parsed.data;
  return {};
}

export function getFolderWatermark(
  config: MiningSourceConfigV1 | undefined,
  folder: string,
): FolderWatermark | undefined {
  return config?.mining?.last?.folders?.[folder];
}

/** Builds the typed `resumeFrom` payload the emails-fetcher expects for a source. */
export function buildResumeFrom(
  config: MiningSourceConfigV1 | undefined,
):
  | { folders: Record<string, { uidvalidity: string; last_uid: number }> }
  | undefined {
  const watermarks = config?.mining?.last?.folders;
  if (!watermarks || Object.keys(watermarks).length === 0) return undefined;
  const folders: Record<string, { uidvalidity: string; last_uid: number }> = {};
  for (const [folder, wm] of Object.entries(watermarks)) {
    folders[folder] = { uidvalidity: wm.uidvalidity, last_uid: wm.last_uid };
  }
  return { folders };
}
