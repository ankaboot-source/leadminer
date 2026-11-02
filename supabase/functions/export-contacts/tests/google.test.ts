/**
 * Tests for the Google Contacts export session.
 *
 * Covers the post-fork backend fix that maps a Google `invalid_grant`
 * refresh-token failure to "Invalid credentials." so the edge function can
 * return the reconnect modal, and the error-metadata logging hardening.
 */
import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { Logger } from "../../_shared/logger.ts";
import GoogleContactsSession from "../formats/google/contacts-api.ts";

interface LogCall {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  context?: Record<string, unknown>;
}

function createSpyLogger(): { logger: Logger; calls: LogCall[] } {
  const calls: LogCall[] = [];
  const record = (
    level: LogCall["level"],
    message: string,
    context?: Record<string, unknown>,
  ) => {
    calls.push({ level, message, context });
  };
  const logger = {
    debug: (message: string, context?: Record<string, unknown>) =>
      record("debug", message, context),
    info: (message: string, context?: Record<string, unknown>) =>
      record("info", message, context),
    warn: (message: string, context?: Record<string, unknown>) =>
      record("warn", message, context),
    error: (message: string, context?: Record<string, unknown>) =>
      record("error", message, context),
  };
  return { logger: logger as unknown as Logger, calls };
}

function stubFetch(handler: () => Promise<Response>): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = handler as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

const noTimerSanitizers = {
  sanitizeOps: false,
  sanitizeResources: false,
};

Deno.test({
  name: "GoogleContactsSession: 401 is reported as invalid credentials",
  ...noTimerSanitizers,
  async fn() {
    const { logger, calls } = createSpyLogger();
    const restore = stubFetch(() =>
      Promise.resolve(new Response("unauthorized", { status: 401 }))
    );

    try {
      const session = new GoogleContactsSession(
        "expired-token",
        "Leadminer",
        "user-1",
        logger,
      );

      await assertRejects(
        () => session.run([], false),
        Error,
        "Invalid credentials.",
      );

      const errorCall = calls.find((call) => call.level === "error");
      assert(errorCall, "expected an error log");
      const meta = errorCall.context?.error as
        | { name?: string; message?: string }
        | undefined;
      assertEquals(meta?.name, "Error");
      assertStringIncludes(meta?.message ?? "", "Invalid credentials.");
    } finally {
      restore();
    }
  },
});

Deno.test({
  name: "GoogleContactsSession: invalid_grant response is reported as invalid credentials",
  ...noTimerSanitizers,
  async fn() {
    const { logger } = createSpyLogger();
    const restore = stubFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: "invalid_grant" }), {
          status: 400,
        }),
      )
    );

    try {
      const session = new GoogleContactsSession(
        "expired-token",
        "Leadminer",
        "user-1",
        logger,
      );

      await assertRejects(
        () => session.run([], false),
        Error,
        "Invalid credentials.",
      );
    } finally {
      restore();
    }
  },
});

Deno.test({
  name: "GoogleContactsSession: non-auth API errors keep their status and message",
  ...noTimerSanitizers,
  async fn() {
    const { logger } = createSpyLogger();
    const restore = stubFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: "quotaExceeded" }), {
          status: 429,
        }),
      )
    );

    try {
      const session = new GoogleContactsSession(
        "token",
        "Leadminer",
        "user-1",
        logger,
      );

      const error = await assertRejects(
        () => session.run([], false),
        Error,
        "Google API error (429)",
      );
      assert(error instanceof Error);
    } finally {
      restore();
    }
  },
});
