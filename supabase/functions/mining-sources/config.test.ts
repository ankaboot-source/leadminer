import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { mergeConfig } from "./config.ts";

Deno.test("mergeConfig merges mining_flags and preserves unknown keys", () => {
  const result = mergeConfig(
    {
      version: 1,
      flags: { cleaning_enabled: false, custom_flag: "keep-me" },
      unknown_namespace: { a: 1 },
      health: { state: "active" },
    },
    { mining_flags: { cleaning_enabled: true } },
  );

  assertEquals(result.flags, { cleaning_enabled: true, custom_flag: "keep-me" });
  assertEquals(
    (result as Record<string, unknown>).unknown_namespace,
    { a: 1 },
  );
  assertEquals(result.health, { state: "active" });
});

Deno.test("mergeConfig null clears folders and mining.last", () => {
  const result = mergeConfig(
    { version: 1, folders: ["INBOX"], mining: { last: { mining_id: "x" } } },
    { folders: null, mining: { last: null } },
  );
  assert(result.folders === undefined);
  assertEquals(result.mining, {});
});

Deno.test("mergeConfig merges health fields", () => {
  const result = mergeConfig(
    { version: 1, health: { state: "active", last_run_at: "t0" } },
    { health: { state: "error", last_error: ["boom"] } },
  );
  assertEquals(result.health, {
    state: "error",
    last_run_at: "t0",
    last_error: ["boom"],
  });
});

Deno.test("mergeConfig applies monotonic per-folder cursors", () => {
  const current = {
    version: 1,
    mining: {
      last: {
        mining_id: "old",
        folders: {
          INBOX: { uidvalidity: "42", last_uid: 100, updated_at: "t0" },
          Archive: { uidvalidity: "7", last_uid: 5, updated_at: "t0" },
        },
      },
    },
  };

  const result = mergeConfig(current, {
    mining: {
      last: {
        mining_id: "new",
        folders: {
          // lower in the same namespace -> ignored
          INBOX: { uidvalidity: "42", last_uid: 10, updated_at: "t1" },
          // higher in the same namespace -> applied
          Archive: { uidvalidity: "7", last_uid: 9, updated_at: "t1" },
        },
      },
    },
  });

  assertEquals(result.mining?.last?.mining_id, "new");
  assertEquals(result.mining?.last?.folders?.INBOX.last_uid, 100);
  assertEquals(result.mining?.last?.folders?.Archive.last_uid, 9);
});

Deno.test("mergeConfig replaces a folder cursor on uidvalidity change", () => {
  const result = mergeConfig(
    {
      version: 1,
      mining: {
        last: {
          folders: {
            INBOX: { uidvalidity: "42", last_uid: 100, updated_at: "t0" },
          },
        },
      },
    },
    {
      mining: {
        last: {
          folders: {
            INBOX: { uidvalidity: "43", last_uid: 3, updated_at: "t1" },
          },
        },
      },
    },
  );
  assertEquals(result.mining?.last?.folders?.INBOX, {
    uidvalidity: "43",
    last_uid: 3,
    updated_at: "t1",
  });
});
