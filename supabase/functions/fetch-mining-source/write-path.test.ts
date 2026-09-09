/**
 * Fix-2 write-path regression test: the refresh write-back must persist
 * `credentials.expiresAt` as a NUMBER in epoch MILLISECONDS.
 *
 * The original bug: one write path stored epoch ms, the refresh write-back
 * stored an ISO string, and the old `expired(300)` read misparsed numeric
 * values as seconds — so auto-refresh never fired. These tests lock in the
 * contract end-to-end: a stale epoch-ms token must trigger refresh, and what
 * gets written must round-trip through isTokenExpired without a unit flip.
 *
 * Strategy: capture the function's Deno.serve handler (no listener needed),
 * stub the lazy Google OAuth client singleton (no network), and intercept
 * supabase-js REST calls via a fetch stub — asserting on the exact RPC
 * payload the function persists.
 */
import {
  assert,
  assertAlmostEquals,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

// skipcq: SCT-A000 - fake test credential, not a real secret
const SERVICE_ROLE_KEY = "srk-write-path-test";
const USER_ID = "9f1d3b28-6f6b-4d9e-9d3e-0b6f1b2e1111";
const SOURCE_EMAIL = "write.path.test@gmail.com";

Deno.env.set("SUPABASE_URL", "http://127.0.0.1:8000");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", SERVICE_ROLE_KEY);
Deno.env.set("LEADMINER_API_HASH_SECRET", "test-hash-secret");
// The lazy OAuth client factory runs when this test resolves the singleton.
Deno.env.set("GOOGLE_CLIENT_ID", "test-google-client-id");
Deno.env.set("GOOGLE_SECRET", "test-google-secret");

// Rows the stubbed credentials RPC returns; mutated per test.
let sourceRows: unknown[] = [];
let capturedUpsert: Record<string, unknown> | undefined;

/** What the stubbed OAuth refresh returns as `expires_in` (seconds). */
const REFRESHED_EXPIRES_IN_S = 3600;

const realFetch = globalThis.fetch;
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  const path = url.pathname;
  if (path.endsWith("/rpc/get_mining_source_credentials_for_user")) {
    return Promise.resolve(
      new Response(JSON.stringify(sourceRows), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  }
  if (path.endsWith("/rpc/upsert_mining_source")) {
    capturedUpsert = JSON.parse(String(init?.body ?? "{}"));
    return Promise.resolve(
      new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  }
  return realFetch(input, init);
}) as typeof fetch;

// Capture the Deno.serve handler so the module's top-level serve call never
// binds a port, then restore the global immediately.
let serveHandler: ((req: Request) => Promise<Response>) | undefined;
{
  const realServe = Deno.serve;
  (Deno as unknown as Record<string, unknown>).serve = ((
    a: unknown,
    b?: unknown,
  ) => {
    serveHandler = (typeof a === "function" ? a : b) as typeof serveHandler;
    return { finished: Promise.resolve(), shutdown: () => Promise.resolve() };
  }) as typeof Deno.serve;

  // Resolve the lazy OAuth singleton BEFORE importing the handler, then stub
  // it so no network call ever happens.
  const { default: getGoogleOAuth2Client } = await import(
    "./oauth-handler/google.ts"
  );
  const client = getGoogleOAuth2Client() as unknown as {
    createToken: (t: unknown) => {
      refresh: () => Promise<{ token: Record<string, unknown> }>;
    };
  };

  client.createToken = () => ({
    refresh: () =>
      Promise.resolve({
        token: {
          // skipcq: SCT-A000 - fake test credential, not a real secret
          access_token: "fresh-access-token",
          // skipcq: SCT-A000 - fake test credential, not a real secret
          refresh_token: "fresh-refresh-token",
          expires_in: REFRESHED_EXPIRES_IN_S,
        },
      }),
  });

  await import("./index.ts");
  (Deno as unknown as Record<string, unknown>).serve = realServe;
}

assert(serveHandler, "Deno.serve handler was not captured");
// Narrowed copy: module-level `let` loses its narrowing inside function bodies.
const handler = serveHandler;

function makeSource(expiresAt: unknown) {
  return {
    id: "e0e0e0e0-1111-4222-8333-444455556666",
    email: SOURCE_EMAIL,
    user_id: USER_ID,
    type: "google",
    credentials: {
      email: SOURCE_EMAIL,
      // skipcq: SCT-A000 - fake test credential, not a real secret
      accessToken: "stale-access-token",
      // skipcq: SCT-A000 - fake test credential, not a real secret
      refreshToken: "stale-refresh-token",
      expiresAt,
      provider: "google",
    },
    config: {},
  };
}

async function post(body: unknown): Promise<{
  status: number;
  payload: Record<string, unknown>;
}> {
  const res = await handler(
    new Request("http://127.0.0.1:8000/", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(body),
    }),
  );
  const payload = await res.json();
  return { status: res.status, payload };
}

Deno.test(
  "stale epoch-ms token triggers refresh; write-back persists epoch-ms number",
  // supabase-js starts an auto-refresh interval internally; not ours to clean.
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    // Stale epoch-ms expiry — exactly the historical storage unit that the
    // seconds-based `expired(300)` read could never see as expired.
    sourceRows = [makeSource(Date.now() - 6 * 3_600_000)];
    capturedUpsert = undefined;
    const before = Date.now();

    const { status, payload } = await post({ user_id: USER_ID });

    assertEquals(status, 200);
    assertEquals(payload.refreshed, [SOURCE_EMAIL]);
    assertEquals(payload.deauthorized, []);

    const returned = (
      payload.sources as {
        credentials: { expiresAt: unknown; accessToken: unknown };
      }[]
    )[0].credentials;
    assertEquals(returned.accessToken, "fresh-access-token");
    assertEquals(typeof returned.expiresAt, "number");

    // The persisted RPC payload carries the same canonical shape.
    // (Explicit type: TS control-flow narrows the closure-mutated binding.)
    const upsert = capturedUpsert as Record<string, unknown> | undefined;
    assert(upsert, "upsert_mining_source was not called");
    assertEquals(upsert._user_id, USER_ID);
    assertEquals(upsert._email, SOURCE_EMAIL);
    assertEquals(upsert._type, "google");
    assert(typeof upsert._credentials === "string");

    const persisted = JSON.parse(String(upsert._credentials));
    assertEquals(persisted.accessToken, "fresh-access-token");
    assertEquals(persisted.refreshToken, "fresh-refresh-token");
    // THE regression: must be a number, never an ISO string.
    assertEquals(typeof persisted.expiresAt, "number");
    // Derived from the stubbed expires_in=3600s => ~before + 1h, in ms.
    assertAlmostEquals(
      persisted.expiresAt as number,
      before + REFRESHED_EXPIRES_IN_S * 1000,
      60_000,
    );
    assertEquals(persisted.expiresAt, returned.expiresAt);
  },
);

Deno.test(
  "fresh token is not refreshed (expiry read gates the refresh path)",
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    sourceRows = [makeSource(Date.now() + 6 * 3_600_000)];
    capturedUpsert = undefined;

    const { status, payload } = await post({ user_id: USER_ID });

    assertEquals(status, 200);
    assertEquals(payload.refreshed, []);
    assertEquals(payload.deauthorized, []);
    assert(
      !capturedUpsert,
      "upsert_mining_source must not run for a fresh token",
    );
  },
);
