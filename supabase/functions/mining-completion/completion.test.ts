import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildCompletionPatch } from "./completion.ts";

const NOW = "2026-09-11T00:00:00.000Z";
const watermark = {
  folders: {
    INBOX: { uidvalidity: "42", last_uid: 100, updated_at: NOW },
  },
};

Deno.test("builds a source patch from a completed fetch task", () => {
  const out = buildCompletionPatch(
    {
      miningId: "m1",
      sourceId: "src-1",
      progress: { processed: 5 },
      watermark,
    },
    "m1",
    NOW,
  );

  assertEquals(out.skip, false);
  if (!out.skip) {
    assertEquals(out.sourceId, "src-1");
    assertEquals(out.patch.health.state, "active");
    assertEquals(out.patch.health.last_error, null);
    assertEquals(out.patch.mining.last.mining_id, "m1");
    assertEquals(out.patch.mining.last.mined_count, 5);
    assertEquals(out.patch.mining.last.folders_mined, ["INBOX"]);
    assertEquals(out.patch.mining.last.folders.INBOX.last_uid, 100);
    assertEquals(out.patch.mining.last.updated_at, NOW);
  }
});

Deno.test("skips when the source id is absent", () => {
  assertEquals(
    buildCompletionPatch({ watermark }, "m1", NOW),
    { skip: true, reason: "no-source-id" },
  );
});

Deno.test("skips when the watermark is absent or invalid", () => {
  assertEquals(
    buildCompletionPatch({ sourceId: "src-1" }, "m1", NOW),
    { skip: true, reason: "no-watermark" },
  );
  assertEquals(
    buildCompletionPatch(
      {
        sourceId: "src-1",
        watermark: { folders: { INBOX: { last_uid: "not-a-number" } } },
      },
      "m1",
      NOW,
    ),
    { skip: true, reason: "no-watermark" },
  );
});

Deno.test("defaults mined_count to 0 when progress is absent", () => {
  const out = buildCompletionPatch(
    { sourceId: "src-1", watermark },
    "m1",
    NOW,
  );
  assertEquals(out.skip, false);
  if (!out.skip) {
    assertEquals(out.patch.mining.last.mined_count, 0);
  }
});
