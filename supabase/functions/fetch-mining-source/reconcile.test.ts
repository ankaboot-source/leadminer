import {
  assert,
  assertFalse,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { hasStaleReauthFlag } from "./oauth-handler/index.ts";

// The stale-flag contract: a stored auth failure must clear as soon as fresh
// credentials are handed out, otherwise the UI shows "connection lost" for a
// source that demonstrably works (proven live: IMAP boxes fetch 200 while the
// banner persisted). Mining Error states are NOT auth failures and survive.

Deno.test("stale on top-level needs_reauth flag", () => {
  assert(hasStaleReauthFlag({ needs_reauth: true }));
  assertFalse(hasStaleReauthFlag({ needs_reauth: false }));
  assertFalse(hasStaleReauthFlag({}));
});

Deno.test("stale on nested health.state needs_reauth (the QA shape)", () => {
  assert(
    hasStaleReauthFlag({
      health: { state: "needs_reauth", last_error: ["Unauthorized"] },
    }),
  );
});

Deno.test("not stale when already active", () => {
  assertFalse(
    hasStaleReauthFlag({ health: { state: "active", last_error: null } }),
  );
});

Deno.test("not stale on mining Error state (run failure, not auth)", () => {
  assertFalse(
    hasStaleReauthFlag({
      health: { state: "error", last_error: ["boom"], last_run_at: "x" },
    }),
  );
});

Deno.test("not stale on missing or garbage config", () => {
  assertFalse(hasStaleReauthFlag(null));
  assertFalse(hasStaleReauthFlag(undefined));
  assertFalse(hasStaleReauthFlag("needs_reauth"));
  assertFalse(hasStaleReauthFlag({ health: null }));
  assertFalse(hasStaleReauthFlag({ health: { state: "bogus" } }));
});
