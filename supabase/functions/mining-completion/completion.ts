import { z } from "zod";
import {
  FOLDER_WATERMARK_SCHEMA,
  type FolderWatermark,
} from "../_shared/mining-source-config.ts";
import { SourceHealthState } from "../_shared/enums.ts";

/** Watermark shape persisted by FetchTask into `tasks.details.watermark`. */
const WATERMARK_SCHEMA = z.object({
  folders: z.record(z.string(), FOLDER_WATERMARK_SCHEMA),
});

const PROGRESS_SCHEMA = z
  .object({ processed: z.number().int().nonnegative().optional() })
  .passthrough();

export type TaskDetails = Record<string, unknown>;

export type CompletionOutcome =
  | {
      skip: false;
      sourceId: string;
      patch: {
        health: {
          state: typeof SourceHealthState.Active;
          last_run_at: string;
          last_error: null;
        };
        mining: {
          last: {
            mining_id: string;
            mined_count: number;
            folders_mined: string[];
            updated_at: string;
            folders: Record<string, FolderWatermark>;
          };
        };
      };
    }
  | { skip: true; reason: "no-source-id" | "no-watermark" };

/**
 * Pure mapping from a fetch task's persisted details to the mining source
 * config patch. Kept free of IO so it can be unit-tested without a database.
 */
export function buildCompletionPatch(
  details: TaskDetails | null | undefined,
  miningId: string,
  now: string,
): CompletionOutcome {
  const sourceId =
    typeof details?.sourceId === "string" ? details.sourceId : undefined;
  if (!sourceId) {
    return { skip: true, reason: "no-source-id" };
  }

  const watermark = WATERMARK_SCHEMA.safeParse(details?.watermark);
  if (!watermark.success) {
    return { skip: true, reason: "no-watermark" };
  }

  const progress = PROGRESS_SCHEMA.safeParse(details?.progress);
  const minedCount = progress.success ? (progress.data.processed ?? 0) : 0;

  return {
    skip: false,
    sourceId,
    patch: {
      health: {
        state: SourceHealthState.Active,
        last_run_at: now,
        last_error: null,
      },
      mining: {
        last: {
          mining_id: miningId,
          mined_count: minedCount,
          folders_mined: Object.keys(watermark.data.folders),
          updated_at: now,
          folders: watermark.data.folders,
        },
      },
    },
  };
}
