import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { SourceHealthState } from "../_shared/enums.ts";
import {
  isReauthFailure,
  shouldNotifyStuckReauth,
} from "./credential-failure.ts";

Deno.test("401 and 403 are reauth failures", () => {
  assertEquals(isReauthFailure({ status: 401 }), true);
  assertEquals(isReauthFailure({ status: 403 }), true);
});

Deno.test("other statuses are not reauth failures", () => {
  assertEquals(isReauthFailure({ status: 500 }), false);
  assertEquals(isReauthFailure({ status: 400 }), false);
  assertEquals(isReauthFailure(), false);
  assertEquals(isReauthFailure(null), false);
  assertEquals(isReauthFailure(new Error("network timeout")), false);
});

Deno.test("a flagged source is notified once", () => {
  assertEquals(
    shouldNotifyStuckReauth(SourceHealthState.NeedsReauth),
    true,
  );
  assertEquals(
    shouldNotifyStuckReauth(
      SourceHealthState.NeedsReauth,
      "2026-10-23T02:00:00.000Z",
    ),
    false,
  );
});

Deno.test("only flagged sources use the stuck-notification path", () => {
  assertEquals(shouldNotifyStuckReauth(SourceHealthState.Active), false);
  assertEquals(shouldNotifyStuckReauth(SourceHealthState.Error), false);
  assertEquals(shouldNotifyStuckReauth(), false);
});
