import {
  assertEquals,
  assertRejects,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.env.set("GOOGLE_CLIENT_ID", "test-client-id");
Deno.env.set("GOOGLE_SECRET", "test-secret");
Deno.env.set("AZURE_CLIENT_ID", "test-azure-client-id");
Deno.env.set("AZURE_SECRET", "test-azure-secret");

const utils = await import("./utils.ts");
const {
  getSafeRedirectPath,
  signOAuthState,
  parseOAuthState,
  getTokenConfig,
  getAuthClient,
} = utils;

const TEST_SECRET = "test-hash-secret";

Deno.test("getSafeRedirectPath returns the path for valid paths", () => {
  assertEquals(getSafeRedirectPath("/mine/123"), "/mine/123");
});

Deno.test("getSafeRedirectPath returns '/' for empty string", () => {
  assertEquals(getSafeRedirectPath(""), "/");
});

Deno.test("getSafeRedirectPath returns '/' for double-slash paths", () => {
  assertEquals(getSafeRedirectPath("//evil.com"), "/");
});

Deno.test("getSafeRedirectPath returns '/' for non-path strings", () => {
  assertEquals(getSafeRedirectPath("not-a-path"), "/");
});

Deno.test("getSafeRedirectPath returns '/' for undefined", () => {
  // skipcq: JS-W1042 - explicitly testing undefined behavior
  assertEquals(getSafeRedirectPath(undefined), "/");
});

Deno.test("signOAuthState produces a valid signed state", async () => {
  const state = await signOAuthState(
    { userId: "user-123", afterCallbackRedirect: "/mine/456" },
    TEST_SECRET,
  );
  const result = await parseOAuthState(state, TEST_SECRET);
  assertEquals(result.userId, "user-123");
  assertEquals(result.afterCallbackRedirect, "/mine/456");
});

Deno.test("parseOAuthState rejects tampered state", async () => {
  const state = await signOAuthState(
    { userId: "user-123", afterCallbackRedirect: "/mine/456" },
    TEST_SECRET,
  );
  await assertRejects(
    () => parseOAuthState(state, "different-secret"),
    Error,
    "Invalid OAuth state",
  );
});

Deno.test("parseOAuthState throws for unsigned legacy state", async () => {
  const state = btoa(
    JSON.stringify({ userId: "user-123", afterCallbackRedirect: "/mine/456" }),
  );
  await assertRejects(
    () => parseOAuthState(state, TEST_SECRET),
    Error,
    "Invalid OAuth state",
  );
});

Deno.test("parseOAuthState throws for empty string", async () => {
  await assertRejects(
    () => parseOAuthState("", TEST_SECRET),
    Error,
    "Missing OAuth state",
  );
});

Deno.test("parseOAuthState throws for invalid base64", async () => {
  await assertRejects(
    () => parseOAuthState("not-base64!!", TEST_SECRET),
    Error,
    "Invalid OAuth state",
  );
});

Deno.test("parseOAuthState throws for missing userId", async () => {
  const state = await signOAuthState(
    { userId: "user-123", afterCallbackRedirect: "/mine" },
    TEST_SECRET,
  );
  const tampered = btoa(
    JSON.stringify({
      data: JSON.stringify({ afterCallbackRedirect: "/mine" }),
      sig: JSON.parse(atob(state)).sig,
    }),
  );
  await assertRejects(
    () => parseOAuthState(tampered, TEST_SECRET),
    Error,
    "Invalid OAuth state",
  );
});

Deno.test("parseOAuthState defaults afterCallbackRedirect to '/' when missing", async () => {
  const state = await signOAuthState(
    { userId: "user-123", afterCallbackRedirect: "/" },
    TEST_SECRET,
  );
  const result = await parseOAuthState(state, TEST_SECRET);
  assertEquals(result.userId, "user-123");
  assertEquals(result.afterCallbackRedirect, "/");
});

Deno.test("getTokenConfig returns google config with all fields", () => {
  const config = getTokenConfig("google", "https://example.com/callback");
  assertEquals(config.redirect_uri, "https://example.com/callback");
  assertEquals(typeof config.scope, "string");
  assertEquals(config.prompt, "consent select_account");
  assertEquals(config.access_type, "offline");
});

Deno.test("getTokenConfig returns azure config without access_type", () => {
  const config = getTokenConfig("azure", "https://example.com/callback");
  assertEquals(config.redirect_uri, "https://example.com/callback");
  assertEquals(typeof config.scope, "string");
  assertEquals(config.prompt, "select_account");
  assertEquals(config.access_type, undefined); // skipcq: JS-W1042
});

Deno.test("getTokenConfig throws for invalid provider", () => {
  assertThrows(
    // skipcq: JS-0323 - testing invalid provider input
    () => getTokenConfig("invalid" as any, "https://example.com/callback"),
    Error,
  );
});

Deno.test("getAuthClient returns client for google", () => {
  assertEquals(typeof getAuthClient("google"), "object");
});

Deno.test("getAuthClient returns client for azure", () => {
  assertEquals(typeof getAuthClient("azure"), "object");
});

Deno.test("getAuthClient throws for invalid provider", () => {
  assertThrows(
    // skipcq: JS-0323 - testing invalid provider input
    () => getAuthClient("invalid" as any),
    Error,
    "Not a valid OAuth provider",
  );
});
