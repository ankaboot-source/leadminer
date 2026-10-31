import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { timingSafeStringEqual } from "./webhook-token.ts";

Deno.test("timingSafeStringEqual: accepts identical tokens", async () => {
  assertEquals(await timingSafeStringEqual("job-token-123", "job-token-123"), true);
});

Deno.test("timingSafeStringEqual: rejects different tokens", async () => {
  assertEquals(await timingSafeStringEqual("job-token-123", "job-token-124"), false);
});

Deno.test("timingSafeStringEqual: rejects tokens of different lengths", async () => {
  assertEquals(await timingSafeStringEqual("job-token", "job-token-123"), false);
  assertEquals(await timingSafeStringEqual("", "a"), false);
});
