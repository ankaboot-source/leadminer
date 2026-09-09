/**
 * Fix-2 write-path regression tests for mining-sources: both credential
 * write paths must store `expiresAt` as an epoch-ms NUMBER.
 *
 * - POST /                        : handoff flow, expiry computed as now + 7h
 * - GET /oauth/callback/:provider : OAuth callback via exchangeForToken
 *
 * Both end at the same `upsert_mining_source` RPC with
 * `_credentials: JSON.stringify({ ... expiresAt })` — these tests boot the
 * real Hono app (handler captured, no port bound) and intercept supabase-js
 * REST calls, asserting on the exact payload that would be encrypted and
 * persisted.
 */
import {
  assert,
  assertAlmostEquals,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

// skipcq: SCT-A000 - fake test credential, not a real secret
const SERVICE_ROLE_KEY = "srk-mining-sources-write-path-test";

Deno.env.set("SUPABASE_URL", "http://127.0.0.1:8000");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", SERVICE_ROLE_KEY);
Deno.env.set("SUPABASE_ANON_KEY", "test-anon-key");
Deno.env.set("LEADMINER_API_HASH_SECRET", "test-hash-secret");
Deno.env.set("FRONTEND_HOST", "http://frontend.test");
// The lazy OAuth client factory runs when this test resolves the singleton.
Deno.env.set("GOOGLE_CLIENT_ID", "test-google-client-id");
Deno.env.set("GOOGLE_SECRET", "test-google-secret");

const USER_ID = "9f1d3b28-6f6b-4d9e-9d3e-0b6f1b2e2222";
const USER_EMAIL = "handoff.test@gmail.com";

let capturedUpsert: Record<string, unknown> | undefined;

const realFetch = globalThis.fetch;
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  const path = url.pathname;
  if (path.endsWith("/auth/v1/user")) {
    // GoTrue user shape for the auth middleware's getUser() call.
    return Promise.resolve(
      new Response(
        JSON.stringify({
          id: USER_ID,
          aud: "authenticated",
          role: "authenticated",
          email: USER_EMAIL,
          app_metadata: { provider: "google" },
          user_metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
  }
  if (path.endsWith("/rpc/upsert_mining_source")) {
    capturedUpsert = JSON.parse(String(init?.body ?? "{}"));
    return Promise.resolve(
      new Response("null", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  }
  if (path.endsWith("/rpc/create_smtp_sender_for_oauth")) {
    return Promise.resolve(
      new Response("null", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  }
  if (path.endsWith("/rest/v1/mining_sources")) {
    // .single() object-mode response for the SMTP-twin source lookup.
    return Promise.resolve(
      new Response(
        JSON.stringify({ id: "e0e0e0e0-1111-4222-8333-444455556666" }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
  }
  return realFetch(input, init);
}) as typeof fetch;

// exchangeForToken → getAuthClient → the lazy singleton in oauth/google.ts
// (utils.ts does not re-export it). Resolve the module graph first, then stub
// the client instance so no network call ever happens.
const { default: getGoogleOAuth2Client } = await import("./oauth/google.ts");
const { signOAuthState } = await import("./oauth/utils.ts");

const client = getGoogleOAuth2Client() as unknown as {
  getToken: (cfg: unknown) => Promise<{ token: Record<string, unknown> }>;
};

const CALLBACK_EMAIL = "callback.test@gmail.com";
const ID_TOKEN = `${btoa(JSON.stringify({ alg: "none", typ: "JWT" }))}.${
  btoa(JSON.stringify({ email: CALLBACK_EMAIL }))
}.sig`;

client.getToken = () =>
  Promise.resolve({
    token: {
      // skipcq: SCT-A000 - fake test credential, not a real secret
      access_token: "cb-access-token",
      // skipcq: SCT-A000 - fake test credential, not a real secret
      refresh_token: "cb-refresh-token",
      id_token: ID_TOKEN,
      scope:
        "openid https://mail.google.com/ https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/contacts",
      expires_in: 3600,
      // seconds — the shape simple-oauth2's parser produces
      expires_at: Date.now() / 1000 + 3600,
      token_type: "Bearer",
    },
  });

// Capture the Deno.serve handler (the Hono app) so no port is bound.
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

  await import("./index.ts");
  (Deno as unknown as Record<string, unknown>).serve = realServe;
}

assert(serveHandler, "Deno.serve handler was not captured");
// Narrowed copy: module-level `let` loses its narrowing inside function bodies.
const handler = serveHandler;

Deno.test(
  "POST / stores credentials.expiresAt as an epoch-ms number (now + 7h)",
  // supabase-js starts an auto-refresh interval internally; not ours to clean.
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    capturedUpsert = undefined;
    const before = Date.now();

    const res = await handler(
      new Request("http://127.0.0.1:8000/mining-sources", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          // A user JWT (any value) — auth middleware resolves it via the
          // stubbed GoTrue /auth/v1/user endpoint above.
          authorization: "Bearer user-jwt-from-gotrue",
        },
        body: JSON.stringify({
          provider: "google",
          // skipcq: SCT-A000 - fake test credential, not a real secret
          provider_token: "handoff-access-token",
          // skipcq: SCT-A000 - fake test credential, not a real secret
          provider_refresh_token: "handoff-refresh-token",
        }),
      }),
    );

    assertEquals(res.status, 200);
    await res.body?.cancel();

    // (Explicit type: TS control-flow narrows the closure-mutated binding.)
    const upsert = capturedUpsert as Record<string, unknown> | undefined;
    assert(upsert, "upsert_mining_source was not called");

    const persisted = JSON.parse(String(upsert._credentials));
    assertEquals(persisted.provider, "google");
    assertEquals(persisted.accessToken, "handoff-access-token");
    assertEquals(persisted.refreshToken, "handoff-refresh-token");
    // THE regression: must be a number in ms, ~now + 7h.
    assertEquals(typeof persisted.expiresAt, "number");
    assertAlmostEquals(
      persisted.expiresAt as number,
      before + 7 * 3_600_000,
      60_000,
    );
  },
);

Deno.test(
  "OAuth callback stores credentials.expiresAt as an epoch-ms number",
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    capturedUpsert = undefined;
    const before = Date.now();

    const state = await signOAuthState(
      {
        userId: "9f1d3b28-6f6b-4d9e-9d3e-0b6f1b2e2222",
        afterCallbackRedirect: "/mine",
      },
      "test-hash-secret",
    );

    const res = await handler(
      new Request(
        `http://127.0.0.1:8000/mining-sources/oauth/callback/google?code=cb-code&state=${
          encodeURIComponent(state)
        }`,
        { redirect: "manual" },
      ),
    );
    await res.body?.cancel();
    assertEquals(res.status, 302);

    const upsert = capturedUpsert as Record<string, unknown> | undefined;
    assert(upsert, "upsert_mining_source was not called");
    assertEquals(upsert._email, CALLBACK_EMAIL);
    assertEquals(upsert._type, "google");

    const persisted = JSON.parse(String(upsert._credentials));
    assertEquals(persisted.accessToken, "cb-access-token");
    assertEquals(persisted.refreshToken, "cb-refresh-token");
    // THE regression: exchangeForToken must normalize to an epoch-ms number,
    // never pass simple-oauth2's Date/seconds shape through unmodified.
    assertEquals(typeof persisted.expiresAt, "number");
    assertAlmostEquals(
      persisted.expiresAt as number,
      before + 3_600_000,
      60_000,
    );
  },
);
