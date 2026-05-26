import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createSchema, authorizeSchema, callbackQuerySchema } from "./schemas.ts";

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
