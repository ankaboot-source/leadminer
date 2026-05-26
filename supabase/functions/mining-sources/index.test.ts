import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { z } from "https://deno.land/x/zod@v3.25/mod.ts";

const createSchema = z.object({
  provider: z.enum(["google", "azure"]),
  provider_token: z.string().min(1),
  provider_refresh_token: z.string().optional().default(""),
});

const authorizeSchema = z.object({
  provider: z.enum(["google", "azure"]),
  redirect: z.string().min(1).startsWith("/").refine((v) => !v.startsWith("//")),
});

Deno.test("createSchema rejects invalid provider", () => {
  const result = createSchema.safeParse({
    provider: "invalid",
    provider_token: "abc",
  });
  assertEquals(result.success, false);
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
});

Deno.test("authorizeSchema rejects empty redirect", () => {
  const result = authorizeSchema.safeParse({
    provider: "google",
    redirect: "",
  });
  assertEquals(result.success, false);
});

Deno.test("authorizeSchema rejects redirect without leading slash", () => {
  const result = authorizeSchema.safeParse({
    provider: "google",
    redirect: "mine/123",
  });
  assertEquals(result.success, false);
});

Deno.test("authorizeSchema rejects redirect starting with double slash", () => {
  const result = authorizeSchema.safeParse({
    provider: "google",
    redirect: "//evil.com",
  });
  assertEquals(result.success, false);
});
