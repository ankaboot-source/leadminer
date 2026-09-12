import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  FolderStatus,
  MiningRunMode,
  SourceHealthState,
  TaskStatus,
} from "./enums.ts";

/**
 * Locks the cross-runtime enum values (mirrored in the backend and frontend).
 * Inline so no shared file is shipped.
 */
Deno.test("mining enum values (edge)", () => {
  assertEquals(MiningRunMode, { Full: "full", Incremental: "incremental" });
  assertEquals(TaskStatus, {
    Running: "running",
    Done: "done",
    Canceled: "canceled",
  });
  assertEquals(SourceHealthState, {
    Active: "active",
    NeedsReauth: "needs_reauth",
    Error: "error",
  });
  assertEquals(FolderStatus, {
    Unmined: "unmined",
    UpToDate: "up_to_date",
    NewMessages: "new_messages",
    UidvalidityChanged: "uidvalidity_changed",
    MetadataUnavailable: "metadata_unavailable",
  });
});
