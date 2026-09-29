import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolvePassiveRunMode } from "./run-mode.ts";
import { MiningRunMode } from "../_shared/enums.ts";
import type { MiningSourceConfigV1 } from "../_shared/mining-source-config.ts";

// Exact shape of the production source that deadlocked: legacy `mining.last`
// (mining_id/folders_mined/updated_at) but no per-folder `folders` cursor.
const stuckConfig = {
  version: 1,
  flags: {
    cleaning_enabled: false,
    extract_signatures: false,
    google_contacts_sync: false,
  },
  health: {
    state: "active",
    last_error: null,
    last_run_at: "2026-09-25T16:50:20.284Z",
  },
  mining: {
    last: {
      mining_id: "DVwxUA",
      updated_at: "2026-09-06T02:00:11.225Z",
      folders_mined: ["[Gmail]/All Mail"],
    },
  },
  folders: ["INBOX"],
} satisfies MiningSourceConfigV1;

Deno.test("no watermark -> Full so the run can bootstrap a cursor", () => {
  assertEquals(resolvePassiveRunMode(stuckConfig), MiningRunMode.Full);
});

Deno.test("legacy folders_mined is not a watermark", () => {
  assertEquals(
    resolvePassiveRunMode({
      ...stuckConfig,
      mining: { last: { mining_id: "x", updated_at: "t", folders: {} } },
    }),
    MiningRunMode.Full,
  );
});

Deno.test("empty config -> Full", () => {
  assertEquals(resolvePassiveRunMode(undefined), MiningRunMode.Full);
  assertEquals(resolvePassiveRunMode({}), MiningRunMode.Full);
});

Deno.test("persisted per-folder cursor -> Incremental", () => {
  assertEquals(
    resolvePassiveRunMode({
      ...stuckConfig,
      mining: {
        last: {
          mining_id: "new",
          updated_at: "t1",
          folders: {
            INBOX: { uidvalidity: "12", last_uid: 42, updated_at: "t1" },
          },
        },
      },
    }),
    MiningRunMode.Incremental,
  );
});
