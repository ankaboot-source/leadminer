import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isReauthFailure } from "./credential-failure.ts";

Deno.test("401 and 403 are reauth failures", () => {
  assertEquals(isReauthFailure({ status: 401 }), true);
  assertEquals(isReauthFailure({ status: 403 }), true);
});

Deno.test("other statuses are not reauth failures", () => {
  assertEquals(isReauthFailure({ status: 500 }), false);
  assertEquals(isReauthFailure({ status: 400 }), false);
  assertEquals(isReauthFailure(undefined), false);
  assertEquals(isReauthFailure(null), false);
  assertEquals(isReauthFailure(new Error("network timeout")), false);
});
