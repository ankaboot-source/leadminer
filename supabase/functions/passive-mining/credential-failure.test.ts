import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { SourceHealthState } from "../_shared/enums.ts";
import {
  isCredentialFailure,
  shouldNotifyCredentialFailure,
} from "./credential-failure.ts";

Deno.test("classifies permanent OAuth errors as credential failures", () => {
  assertEquals(
    isCredentialFailure(new Error("invalid_grant"), "google"),
    true,
  );
});

Deno.test("classifies OAuth re-auth responses as credential failures", () => {
  assertEquals(
    isCredentialFailure(
      { status: 401, message: "OAuth connection needs re-authentication" },
      "google",
    ),
    true,
  );
  assertEquals(
    isCredentialFailure(
      { status: 401, message: "upstream unauthorized" },
      "google",
    ),
    false,
  );
});

Deno.test("classifies IMAP HTTP 401 and 403 as credential failures", () => {
  assertEquals(isCredentialFailure({ status: 401 }, "imap"), true);
  assertEquals(isCredentialFailure({ status: 403 }, "imap"), true);
});

Deno.test("does not classify transient failures as credential failures", () => {
  assertEquals(isCredentialFailure({ status: 500 }, "imap"), false);
  assertEquals(
    isCredentialFailure(new Error("network timeout"), "imap"),
    false,
  );
});

Deno.test("notifies only after a new actionable failure is persisted", () => {
  assertEquals(
    shouldNotifyCredentialFailure({
      previousState: SourceHealthState.Active,
      credentialFailure: true,
      healthPersisted: true,
    }),
    true,
  );
  assertEquals(
    shouldNotifyCredentialFailure({
      previousState: SourceHealthState.Error,
      credentialFailure: true,
      healthPersisted: true,
    }),
    true,
  );
});

Deno.test("does not notify for an existing or failed state transition", () => {
  assertEquals(
    shouldNotifyCredentialFailure({
      previousState: SourceHealthState.NeedsReauth,
      credentialFailure: true,
      healthPersisted: true,
    }),
    false,
  );
  assertEquals(
    shouldNotifyCredentialFailure({
      previousState: SourceHealthState.Active,
      credentialFailure: false,
      healthPersisted: true,
    }),
    false,
  );
  assertEquals(
    shouldNotifyCredentialFailure({
      previousState: SourceHealthState.Active,
      credentialFailure: true,
      healthPersisted: false,
    }),
    false,
  );
});
