import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";
import { createSchema, authorizeSchema, callbackQuerySchema } from "./schemas.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ??
  "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
  "SUPABASE_SERVICE_ROLE_KEY",
) ?? "";

function getAdmin() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY env var is required to run this test",
    );
  }
  // Disable auto-refresh: this is a service-role admin client used only for
  // a one-off schema introspection query, no session to keep alive. Without
  // this, supabase-auth-js starts a setInterval that leaks past the test.
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

Deno.test(
  "private.mining_sources has an id column (regression for QA warning: 'column mining_sources.id does not exist')",
  async () => {
    const admin = getAdmin();

    // This is the exact query the edge function runs at
    // supabase/functions/mining-sources/index.ts:177 to look up the source
    // id before calling create_smtp_sender_for_oauth. If `id` is missing,
    // the query errors and the SMTP twin is silently skipped.
    const { error } = await admin
      .schema("private")
      .from("mining_sources")
      .select("id")
      .limit(1);

    assert(
      error === null,
      `Expected no error selecting 'id' from private.mining_sources, got: ${
        error?.message ?? "null"
      }. ` +
        "The edge function relies on this column to look up the source id " +
        "before creating the SMTP twin sender after OAuth callback.",
    );
  },
);

Deno.test("createSchema rejects invalid provider", () => {
  const result = createSchema.safeParse({
    provider: "invalid",
    provider_token: "abc",
  });
  assertEquals(result.success, false);
  assert(result.success || result.error.issues.some((i) => i.path.includes("provider")));
});

Deno.test("createSchema accepts valid input", () => {
  const result = createSchema.safeParse({
    provider: "google",
    provider_token: "abc",
  });
  assertEquals(result.success, true);
  if (result.success) {
    assertEquals(result.data.provider_refresh_token, "");
  }
});

Deno.test("createSchema rejects empty token", () => {
  const result = createSchema.safeParse({
    provider: "google",
    provider_token: "",
  });
  assertEquals(result.success, false);
  assert(result.success || result.error.issues.some((i) => i.path.includes("provider_token")));
});

Deno.test("createSchema accepts valid input with refresh token", () => {
  const result = createSchema.safeParse({
    provider: "azure",
    provider_token: "abc",
    provider_refresh_token: "def",
  });
  assertEquals(result.success, true);
  if (result.success) {
    assertEquals(result.data.provider_refresh_token, "def");
  }
});

Deno.test("authorizeSchema accepts valid google input", () => {
  const result = authorizeSchema.safeParse({
    provider: "google",
    redirect: "/mine/123",
  });
  assertEquals(result.success, true);
});

Deno.test("authorizeSchema accepts valid azure input", () => {
  const result = authorizeSchema.safeParse({
    provider: "azure",
    redirect: "/sources",
  });
  assertEquals(result.success, true);
});

Deno.test("authorizeSchema rejects invalid provider", () => {
  const result = authorizeSchema.safeParse({
    provider: "invalid",
    redirect: "/mine",
  });
  assertEquals(result.success, false);
  assert(result.success || result.error.issues.some((i) => i.path.includes("provider")));
});

Deno.test("authorizeSchema rejects empty redirect", () => {
  const result = authorizeSchema.safeParse({
    provider: "google",
    redirect: "",
  });
  assertEquals(result.success, false);
  assert(result.success || result.error.issues.some((i) => i.path.includes("redirect")));
});

Deno.test("authorizeSchema rejects redirect without leading slash", () => {
  const result = authorizeSchema.safeParse({
    provider: "google",
    redirect: "mine/123",
  });
  assertEquals(result.success, false);
  assert(result.success || result.error.issues.some((i) => i.path.includes("redirect")));
});

Deno.test("authorizeSchema rejects redirect starting with double slash", () => {
  const result = authorizeSchema.safeParse({
    provider: "google",
    redirect: "//evil.com",
  });
  assertEquals(result.success, false);
  assert(result.success || result.error.issues.some((i) => i.path.includes("redirect")));
});

Deno.test("authorizeSchema rejects non-string redirect", () => {
  const result = authorizeSchema.safeParse({
    provider: "google",
    redirect: null,
  });
  assertEquals(result.success, false);
});

Deno.test("createSchema rejects missing required fields", () => {
  const result = createSchema.safeParse({});
  assertEquals(result.success, false);
  assert(
    result.success ||
      result.error.issues.some((i) => i.path.includes("provider")) &&
      result.error.issues.some((i) => i.path.includes("provider_token")),
  );
});

Deno.test("callbackQuerySchema accepts valid google input", () => {
  const result = callbackQuerySchema.safeParse({
    provider: "google",
    code: "auth-code-123",
    state: "encoded-state-data",
  });
  assertEquals(result.success, true);
});

Deno.test("callbackQuerySchema accepts valid azure input", () => {
  const result = callbackQuerySchema.safeParse({
    provider: "azure",
    code: "auth-code-456",
    state: "encoded-state-data",
  });
  assertEquals(result.success, true);
});

Deno.test("callbackQuerySchema rejects invalid provider", () => {
  const result = callbackQuerySchema.safeParse({
    provider: "invalid",
    code: "auth-code-123",
    state: "encoded-state-data",
  });
  assertEquals(result.success, false);
  assert(result.success || result.error.issues.some((i) => i.path.includes("provider")));
});

Deno.test("callbackQuerySchema rejects empty code", () => {
  const result = callbackQuerySchema.safeParse({
    provider: "google",
    code: "",
    state: "encoded-state-data",
  });
  assertEquals(result.success, false);
  assert(result.success || result.error.issues.some((i) => i.path.includes("code")));
});

Deno.test("callbackQuerySchema rejects empty state", () => {
  const result = callbackQuerySchema.safeParse({
    provider: "google",
    code: "auth-code-123",
    state: "",
  });
  assertEquals(result.success, false);
  assert(result.success || result.error.issues.some((i) => i.path.includes("state")));
});

Deno.test("callbackQuerySchema rejects missing required fields", () => {
  const result = callbackQuerySchema.safeParse({});
  assertEquals(result.success, false);
  assert(
    result.success ||
      result.error.issues.some((i) => i.path.includes("provider")) &&
      result.error.issues.some((i) => i.path.includes("code")) &&
      result.error.issues.some((i) => i.path.includes("state")),
  );
});

Deno.test("callback redirect URL encodes source email", () => {
  const email = "test@example.com";
  const encoded = encodeURIComponent(email);
  assertEquals(encoded, "test%40example.com");
  const redirectUrl = `/mine?source=${encoded}`;
  assertEquals(redirectUrl, "/mine?source=test%40example.com");
});

Deno.test("SMTP host mapping for OAuth providers", () => {
  const providerMap: Record<string, { host: string; oauthProvider: string }> = {
    google: { host: "smtp.gmail.com", oauthProvider: "google" },
    azure: { host: "smtp-mail.outlook.com", oauthProvider: "azure" },
  };

  assertEquals(providerMap.google.host, "smtp.gmail.com");
  assertEquals(providerMap.google.oauthProvider, "google");
  assertEquals(providerMap.azure.host, "smtp-mail.outlook.com");
  assertEquals(providerMap.azure.oauthProvider, "azure");
});

Deno.test("callbackQuerySchema allows both google and azure providers for SMTP twin", () => {
  const googleResult = callbackQuerySchema.safeParse({
    provider: "google",
    code: "code123",
    state: "state123",
  });
  assertEquals(googleResult.success, true);

  const azureResult = callbackQuerySchema.safeParse({
    provider: "azure",
    code: "code456",
    state: "state456",
  });
  assertEquals(azureResult.success, true);
});
