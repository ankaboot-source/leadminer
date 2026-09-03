import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
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

Deno.test("permanent when error code is invalid_grant", () => {
  assert(isPermanentOAuthError({ error: "invalid_grant" }));
});

Deno.test("permanent when Azure error_codes contains a dead-grant code", () => {
  assert(
    isPermanentOAuthError({ error: "invalid_grant", error_codes: [70000, 90033] }),
  );
  assert(
    isPermanentOAuthError({ error: "invalid_grant", error_codes: [70008, 90033] }),
  );
  assert(
    isPermanentOAuthError({ error: "invalid_grant", error_codes: [50173, 90033] }),
  );
});

Deno.test("permanent when message embeds documented AADSTS code", () => {
  assert(
    isPermanentOAuthError(
      new Error("AADSTS700082: refresh token expired due to inactivity"),
    ),
  );
  assert(
    isPermanentOAuthError(
      new Error("AADSTS50173: grant expired because it was revoked"),
    ),
  );
});

Deno.test("transient when unknown/network/server error", () => {
  assert(!isPermanentOAuthError(new Error("network timeout")));
  assert(!isPermanentOAuthError({ error: "temporarily_unavailable" }));
  assert(!isPermanentOAuthError({ error: "unauthorized_client" }));
});

Deno.test("never crashes on circular or exotic inputs", () => {
  const circular: Record<string, unknown> = { message: "x" };
  circular.self = circular;
  assert(!isPermanentOAuthError(circular));
  assert(!isPermanentOAuthError(null));
  assert(!isPermanentOAuthError(undefined));
  assert(!isPermanentOAuthError(Symbol("x")));
  // Legacy circular shape with invalid_grant still classifies (no crash)
  assertEquals(isPermanentOAuthError(makeCircularError()), true);
});

Deno.test("permanent on the real simple-oauth2 Boom shape (data.payload)", () => {
  // This is what refreshAccessToken() actually throws.
  const boom = Object.assign(new Error("Response Error: 400 Bad Request"), {
    data: {
      payload: {
        error: "invalid_grant",
        error_description: "AADSTS50173: The provided grant has expired...",
        error_codes: [50173, 90033],
      },
    },
  });
  assert(isPermanentOAuthError(boom));
});
