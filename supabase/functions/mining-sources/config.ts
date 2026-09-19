import { createSupabaseAdmin } from "../_shared/supabase.ts";
import { createLogger } from "../_shared/logger.ts";
import {
  parseConfig,
  type MiningSourceConfigV1,
} from "../_shared/mining-source-config.ts";
import type { SourceHealthState } from "../_shared/enums.ts";

const logger = createLogger("mining-sources-config");

type PlainObject = Record<string, unknown>;
const isPlainObject = (value: unknown): value is PlainObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Params a caller may send to update a source. Callers never assemble the
 * persisted config object: the service maps these params onto the config
 * namespaces and merges (unknown keys are preserved, `null` clears).
 */
export interface ConfigureSourceParams {
  /** User-facing flags (frontend sends `mining_flags`). */
  mining_flags?: {
    cleaning_enabled?: boolean;
    extract_signatures?: boolean;
    google_contacts_sync?: boolean;
  };
  /** Selected folders; `null` clears. */
  folders?: string[] | null;
  /** Also toggles the `passive_mining` column. */
  passive_mining?: boolean;
  /** Internal (service role): health updates from run start/failure. */
  health?: {
    state?: SourceHealthState;
    last_error?: string[] | null;
    last_run_at?: string | null;
  };
  /** Internal (service role): completion watermark. */
  mining?: {
    last?:
      | {
          mining_id?: string | null;
          mined_count?: number;
          folders_mined?: string[];
          updated_at?: string;
          folders?: Record<string, FolderWatermark>;
        }
      | null;
  };
}

interface FolderWatermark {
  uidvalidity: string;
  last_uid: number;
  total_messages?: number;
  updated_at: string;
}

/** Monotonic per-folder cursors: same namespace never moves backwards. */
function mergeCompletionFolders(
  currentFolders: Record<string, FolderWatermark> | undefined,
  patchFolders: Record<string, FolderWatermark> | undefined,
): Record<string, FolderWatermark> {
  const merged: Record<string, FolderWatermark> = { ...(currentFolders ?? {}) };
  for (const [folder, patch] of Object.entries(patchFolders ?? {})) {
    const current = merged[folder];
    const sameNamespace =
      current !== undefined && current.uidvalidity === patch.uidvalidity;
    const wouldGoBackwards =
      sameNamespace &&
      Number.isInteger(current.last_uid) &&
      Number.isInteger(patch.last_uid) &&
      patch.last_uid < current.last_uid;
    merged[folder] = wouldGoBackwards ? current : patch;
  }
  return merged;
}

/**
 * Pure merge of source params onto the current config. Unknown/legacy keys are
 * preserved; only the namespaces a param targets are touched.
 */
export function mergeConfig(
  currentRaw: unknown,
  params: ConfigureSourceParams,
): MiningSourceConfigV1 {
  const current = parseConfig(currentRaw) as PlainObject;
  const next: PlainObject = { ...current, version: 1 };

  if (params.mining_flags !== undefined) {
    next.flags = {
      ...(isPlainObject(current.flags) ? current.flags : {}),
      ...params.mining_flags,
    };
  }

  if (params.folders !== undefined) {
    if (params.folders === null) {
      delete next.folders;
    } else {
      next.folders = params.folders;
    }
  }

  if (params.health !== undefined) {
    next.health = {
      ...(isPlainObject(current.health) ? current.health : {}),
      ...params.health,
    };
  }

  if (params.mining !== undefined) {
    const currentMining = isPlainObject(current.mining) ? current.mining : {};
    const nextMining: PlainObject = { ...currentMining };
    if (params.mining.last === null) {
      delete nextMining.last;
    } else if (params.mining.last !== undefined) {
      const currentLast = isPlainObject(currentMining.last)
        ? currentMining.last
        : {};
      nextMining.last = {
        ...currentLast,
        ...params.mining.last,
        folders: mergeCompletionFolders(
          currentLast.folders as Record<string, FolderWatermark> | undefined,
          params.mining.last.folders,
        ),
      };
    }
    next.mining = nextMining;
  }

  return next as MiningSourceConfigV1;
}

export interface AppliedConfig {
  config: MiningSourceConfigV1;
  revision: number;
}

/**
 * The single writer for `mining_sources` config. Read-merge-write with an
 * optimistic compare-and-swap on `config_revision` (retried once) instead of a
 * bespoke SQL merge function.
 */
export async function applySourceConfig(
  sourceId: string,
  params: ConfigureSourceParams,
): Promise<AppliedConfig | null> {
  const admin = createSupabaseAdmin();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data, error } = await admin
      .schema("private")
      .from("mining_sources")
      .select("config, config_revision")
      .eq("id", sourceId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    const revision = Number(data.config_revision ?? 0);
    const config = mergeConfig(data.config, params);

    const update: PlainObject = {
      config,
      config_revision: revision + 1,
    };
    if (params.passive_mining !== undefined) {
      update.passive_mining = params.passive_mining;
    }

    const { data: updated, error: updateError } = await admin
      .schema("private")
      .from("mining_sources")
      .update(update)
      .eq("id", sourceId)
      .eq("config_revision", revision)
      .select("config, config_revision")
      .maybeSingle();

    if (updateError) throw new Error(updateError.message);

    if (updated) {
      return {
        config: updated.config as MiningSourceConfigV1,
        revision: Number(updated.config_revision ?? revision + 1),
      };
    }

    logger.warn("Config revision changed underneath us; retrying", {
      sourceId,
      revision,
    });
  }

  throw new Error("Failed to update mining source config after retry");
}
