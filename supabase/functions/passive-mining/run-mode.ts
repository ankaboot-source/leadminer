import { MiningRunMode } from "../_shared/enums.ts";
import {
  hasFolderWatermark,
  type MiningSourceConfigV1,
} from "../_shared/mining-source-config.ts";

/**
 * Passive mining mirrors the manual UI: a source with no persisted UID
 * watermark must run a full scan so the fetcher can establish one. A
 * date-filtered (`since`) scan cannot advance a cursor, so an unmined source
 * that used one would never acquire a watermark.
 */
export function resolvePassiveRunMode(
  config: MiningSourceConfigV1 | undefined,
): MiningRunMode {
  return hasFolderWatermark(config)
    ? MiningRunMode.Incremental
    : MiningRunMode.Full;
}
