import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isPermanentOAuthError } from "./index.ts";

function makeCircularError(): unknown {
  const err: Record<string, unknown> = {
    message: "invalid_grant",
    data: { body: { error: "invalid_grant" } },
  };
  err.req = err;
  err.res = { req: err };
  return err;
}

Deno.test("isPermanentOAuthError returns true for invalid_grant message", () => {
  assertEquals(isPermanentOAuthError(new Error("invalid_grant")), true);
});

Deno.test("isPermanentOAuthError returns true for revoked token body", () => {
  const err = new Error("Response Error: 401 Unauthorized") as Error & {
    data?: unknown;
  };
  err.data = { error: "Token has been revoked" };
  assertEquals(isPermanentOAuthError(err), true);
});

Deno.test("isPermanentOAuthError returns true for circular error (no crash)", () => {
  assertEquals(isPermanentOAuthError(makeCircularError()), true);
});

Deno.test("isPermanentOAuthError returns false for transient failures", () => {
  assertEquals(
    isPermanentOAuthError(new Error("network timeout")),
    false,
  );
});

Deno.test("isPermanentOAuthError handles null/undefined without crashing", () => {
  assertEquals(isPermanentOAuthError(null), false);
});

Deno.test("isPermanentOAuthError never crashes on exotic error shapes", () => {
  const symbolErr = { message: String(Symbol("x")) };
  assertEquals(typeof isPermanentOAuthError(symbolErr), "boolean");
});