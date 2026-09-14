import {
  assert,
  assertAlmostEquals,
  assertEquals,
  assertFalse,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { Token } from "simple-oauth2";
import {
  isPermanentOAuthError,
  isTokenExpired,
  normalizeExpiresAtMs,
  OAuthMiningSourceCredentials,
  refreshedExpiresAtMs,
} from "./index.ts";

// -- Fix-2 regression tests: expiry unit normalization -----------------------
// The original bug: credentials stored `expiresAt` in epoch MILLISECONDS but
// simple-oauth2's parser multiplies numeric values by 1000 (assumes seconds),
// so `expired(300)` never fired and auto-refresh was dead code.

function creds(expiresAt: unknown): OAuthMiningSourceCredentials {
  return {
    email: "u@example.com",
    accessToken: "at",
    refreshToken: "rt",
    expiresAt,
    provider: "google",
  } as unknown as OAuthMiningSourceCredentials;
}

Deno.test("normalizeExpiresAtMs keeps epoch-ms values as-is", () => {
  assertEquals(normalizeExpiresAtMs(1789000000000), 1789000000000);
  assertEquals(normalizeExpiresAtMs(Date.now()), Date.now());
});

Deno.test("normalizeExpiresAtMs converts epoch-seconds to ms", () => {
  assertEquals(normalizeExpiresAtMs(1789000000), 1789000000000);
});

Deno.test("normalizeExpiresAtMs parses ISO strings as dates (never seconds)", () => {
  const iso = "2026-09-09T12:00:00.000Z";
  assertEquals(normalizeExpiresAtMs(iso), Date.parse(iso));
  // A small epoch as a string is still a DATE: parsed in local time, so the
  // expectation must go through Date.parse too (never x1000 as seconds).
  assertEquals(
    normalizeExpiresAtMs("1970-01-01T00:16:40Z"),
    Date.parse("1970-01-01T00:16:40Z"),
  );
});

Deno.test("normalizeExpiresAtMs applies the 1e11 seconds-vs-ms boundary", () => {
  // Just below 1e11: impossible as ms (year ~5138), so treated as seconds.
  assertEquals(normalizeExpiresAtMs(99_999_999_999), 99_999_999_999_000);
  // At/above 1e11: treated as milliseconds, unchanged.
  assertEquals(normalizeExpiresAtMs(100_000_000_000), 100_000_000_000);
  assertEquals(normalizeExpiresAtMs(1e12), 1e12);
});

Deno.test("normalizeExpiresAtMs returns null for missing or garbage expiry", () => {
  // skipcq: JS-W1042 - garbage inputs are the point of this test
  assertEquals(normalizeExpiresAtMs(undefined), null);
  // skipcq: JS-W1042
  assertEquals(normalizeExpiresAtMs(null), null);
  assertEquals(normalizeExpiresAtMs("not-a-date"), null);
  assertEquals(normalizeExpiresAtMs(""), null);
  assertEquals(normalizeExpiresAtMs(Number.NaN), null);
  assertEquals(normalizeExpiresAtMs(Number.POSITIVE_INFINITY), null);
  // skipcq: JS-W1042
  assertEquals(normalizeExpiresAtMs({}), null);
});

Deno.test("isTokenExpired forces refresh when expiry is missing or garbage", () => {
  // Pass through a variable: a literal `undefined` in the call is what the
  // missing-expiry path must handle, but the linter flags the literal.
  const missingExpiry: unknown = undefined;
  assert(isTokenExpired(creds(missingExpiry)));
  assert(isTokenExpired(creds("garbage")));
  assert(isTokenExpired(creds(Number.NaN)));
  assert(isTokenExpired(creds(Number.POSITIVE_INFINITY)));
});

Deno.test("isTokenExpired is false for a fresh token (headroom respected)", () => {
  assertFalse(isTokenExpired(creds(Date.now() + 6 * 3_600_000)));
});

Deno.test("isTokenExpired is true inside the 300s headroom", () => {
  // 299s from now is within the 5-minute refresh window.
  assert(isTokenExpired(creds(Date.now() + 299_000)));
});

Deno.test("isTokenExpired is false just beyond the 300s headroom", () => {
  assertFalse(isTokenExpired(creds(Date.now() + 301_000)));
});

Deno.test("isTokenExpired accepts every legacy stored format (ms, seconds, ISO)", () => {
  // Stale epoch ms (the historical QA storage unit) must read as expired.
  assert(isTokenExpired(creds(Date.now() - 3_600_000)));
  // Stale epoch seconds.
  assert(isTokenExpired(creds(Math.floor((Date.now() - 3_600_000) / 1000))));
  // Stale ISO string (the old refresh write-back format).
  assert(
    isTokenExpired(creds(new Date(Date.now() - 3_600_000).toISOString())),
  );
  // Fresh ISO string must NOT read as expired.
  assertFalse(
    isTokenExpired(creds(new Date(Date.now() + 3_600_000).toISOString())),
  );
});

Deno.test("refreshedExpiresAtMs derives epoch ms from expires_in (seconds)", () => {
  const before = Date.now();
  const result = refreshedExpiresAtMs({ expires_in: 3600 } as unknown as Token);
  assertAlmostEquals(result, before + 3_600_000, 5_000);
});

Deno.test("refreshedExpiresAtMs falls back to a Date expires_at", () => {
  const expiresAt = new Date(Date.now() + 1_800_000);
  const result = refreshedExpiresAtMs(
    { expires_at: expiresAt } as unknown as Token,
  );
  assertAlmostEquals(result, expiresAt.getTime(), 2_000);
});

Deno.test("refreshedExpiresAtMs converts a numeric seconds expires_at to ms", () => {
  const before = Date.now();
  const result = refreshedExpiresAtMs({
    expires_at: before / 1000 + 1800,
  } as unknown as Token);
  assertAlmostEquals(result, before + 1_800_000, 5_000);
});

Deno.test("refreshedExpiresAtMs falls back to now + 1h when nothing is usable", () => {
  const before = Date.now();
  const result = refreshedExpiresAtMs({} as unknown as Token);
  assertAlmostEquals(result, before + 3_600_000, 5_000);
});

function makeCircularError(): unknown {
  const err: Record<string, unknown> = {
    message: "invalid_grant",
    data: { body: { error: "invalid_grant" } },
  };
  err.req = err;
  err.res = { req: err };
  return err;
}

Deno.test("permanent when error code is invalid_grant", () => {
  assert(isPermanentOAuthError({ error: "invalid_grant" }));
});

Deno.test("permanent when Azure error_codes contains a dead-grant code", () => {
  assert(
    isPermanentOAuthError({ error: "invalid_grant", error_codes: [70000, 90033] }),
  );
  assert(
    isPermanentOAuthError({ error: "invalid_grant", error_codes: [70008, 90033] }),
  );
  assert(
    isPermanentOAuthError({ error: "invalid_grant", error_codes: [50173, 90033] }),
  );
});

Deno.test("permanent when message embeds documented AADSTS code", () => {
  assert(
    isPermanentOAuthError(
      new Error("AADSTS700082: refresh token expired due to inactivity"),
    ),
  );
  assert(
    isPermanentOAuthError(
      new Error("AADSTS50173: grant expired because it was revoked"),
    ),
  );
});

Deno.test("transient when unknown/network/server error", () => {
  assert(!isPermanentOAuthError(new Error("network timeout")));
  assert(!isPermanentOAuthError({ error: "temporarily_unavailable" }));
  assert(!isPermanentOAuthError({ error: "unauthorized_client" }));
});

Deno.test("never crashes on circular or exotic inputs", () => {
  const circular: Record<string, unknown> = { message: "x" };
  circular.self = circular;
  assert(!isPermanentOAuthError(circular));
  assert(!isPermanentOAuthError(null));
  assert(!isPermanentOAuthError(Symbol("x")));
  // Legacy circular shape with invalid_grant still classifies (no crash)
  assertEquals(isPermanentOAuthError(makeCircularError()), true);
});

Deno.test("permanent on the real simple-oauth2 Boom shape (data.payload)", () => {
  // This is what refreshAccessToken() actually throws.
  const boom = Object.assign(new Error("Response Error: 400 Bad Request"), {
    data: {
      payload: {
        error: "invalid_grant",
        error_description: "AADSTS50173: The provided grant has expired...",
        error_codes: [50173, 90033],
      },
    },
  });
  assert(isPermanentOAuthError(boom));
});
