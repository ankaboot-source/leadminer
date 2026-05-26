import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.env.set("GOOGLE_CLIENT_ID", "test-client-id");
Deno.env.set("GOOGLE_SECRET", "test-secret");
Deno.env.set("AZURE_CLIENT_ID", "test-azure-client-id");
Deno.env.set("AZURE_SECRET", "test-azure-secret");

const utils = await import("./utils.ts");
const { getSafeRedirectPath, parseOAuthState, getTokenConfig, getAuthClient } =
  utils;

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
  assertEquals(getSafeRedirectPath(undefined), "/");
});

Deno.test("parseOAuthState decodes valid state", () => {
  const state = btoa(
    JSON.stringify({ userId: "user-123", afterCallbackRedirect: "/mine/456" }),
  );
  const result = parseOAuthState(state);
  assertEquals(result.userId, "user-123");
  assertEquals(result.afterCallbackRedirect, "/mine/456");
});

Deno.test("parseOAuthState throws for empty string", () => {
  assertThrows(() => parseOAuthState(""), Error, "Missing OAuth state");
});

Deno.test("parseOAuthState throws for invalid base64", () => {
  assertThrows(
    () => parseOAuthState("not-base64!!"),
    Error,
    "Invalid OAuth state",
  );
});

Deno.test("parseOAuthState throws for missing userId", () => {
  const state = btoa(JSON.stringify({ afterCallbackRedirect: "/mine" }));
  assertThrows(
    () => parseOAuthState(state),
    Error,
    "Missing userId in OAuth state",
  );
});

Deno.test("parseOAuthState throws for non-string userId", () => {
  const state = btoa(JSON.stringify({ userId: 123 }));
  assertThrows(
    () => parseOAuthState(state),
    Error,
    "Missing userId in OAuth state",
  );
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
  assertEquals(config.access_type, undefined);
});

Deno.test("getAuthClient returns client for google", () => {
  assertEquals(typeof getAuthClient("google"), "object");
});

Deno.test("getAuthClient returns client for azure", () => {
  assertEquals(typeof getAuthClient("azure"), "object");
});

Deno.test("getAuthClient throws for invalid provider", () => {
  assertThrows(
    () => getAuthClient("invalid" as any),
    Error,
    "Not a valid OAuth provider",
  );
});
