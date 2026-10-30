/**
 * Behavior tests for the enrichment engines ported from the backend.
 *
 * These focus on the post-fork main fixes that had to be carried over to the
 * edge code:
 * - raw contact payloads must not be written to logs (PII redaction),
 * - thrown values must be logged through `errorMeta` instead of as raw
 *   objects,
 * - engine parsers keep the backend's result-shaping behavior.
 */
import {
  assert,
  assertEquals,
  assertFalse,
  assertRejects,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { Logger } from "../../_shared/logger.ts";
import type { Engine, EngineResponse, Person } from "./engine.ts";
import Enricher from "./enricher.ts";
import EnrichLayer from "./enrich-layer.ts";
import Thedig from "./thedig.ts";
import Voilanorbert from "./voilanorbert.ts";

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

function assertNoPii(calls: LogCall[], values: string[]) {
  const serialized = JSON.stringify(calls);
  for (const value of values) {
    assertFalse(
      serialized.includes(value),
      `log output must not contain ${value}`,
    );
  }
}

function stubFetch(
  handler: () => Promise<Response>,
): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = handler as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

const PERSON: Partial<Person> = {
  email: "pii@example.com",
  name: "Jane Doe",
  identifiers: ["contact-id"],
};

const noTimerSanitizers = {
  sanitizeOps: false,
  sanitizeResources: false,
};

Deno.test({
  name: "Enricher: logs safe error metadata instead of the raw contact",
  ...noTimerSanitizers,
  async fn() {
    const { logger, calls } = createSpyLogger();
    const failingEngine: Engine = {
      name: "failing",
      isSync: true,
      isAsync: false,
      isValid: () => true,
      enrichAsync: () => Promise.reject(new Error("not used")),
      enrichSync: () =>
        Promise.reject(
          Object.assign(new Error("provider down"), { status: 503 }),
        ),
      parseResult: () => ({ engine: "failing", data: [], raw_data: [] }),
    };

    const enricher = new Enricher([failingEngine], logger);
    const result = await enricher.enrichSync(PERSON);

    assertEquals(result, null);
    assertEquals(calls.length, 1);
    assertEquals(calls[0].level, "error");
    assertStringIncludes(calls[0].message, "[EnrichEngine._sync]");
    assertEquals(calls[0].context?.error, {
      name: "Error",
      message: "provider down",
      status: 503,
      stack: calls[0].context?.error &&
        (calls[0].context.error as { stack?: string }).stack,
    });
    assertNoPii(calls, ["pii@example.com", "Jane Doe"]);
  },
});

Deno.test({
  name: "Enricher: throws when no sync engine is applicable",
  ...noTimerSanitizers,
  async fn() {
    const { logger } = createSpyLogger();
    const enricher = new Enricher([], logger);

    await assertRejects(
      () => enricher.enrichSync(PERSON),
      Error,
      "No Engines to use.",
    );
  },
});

Deno.test({
  name: "Enricher: returns the first sync engine result that has data",
  ...noTimerSanitizers,
  async fn() {
    const { logger } = createSpyLogger();
    const empty: EngineResponse = { engine: "empty", data: [], raw_data: [] };
    const hit: EngineResponse = {
      engine: "hit",
      data: [{ email: "pii@example.com", name: "Jane Doe" }],
      raw_data: [],
    };
    const engine = (name: string, response: EngineResponse): Engine => ({
      name,
      isSync: true,
      isAsync: false,
      isValid: () => true,
      enrichAsync: () => Promise.reject(new Error("not used")),
      enrichSync: () => Promise.resolve(response),
      parseResult: () => response,
    });

    const enricher = new Enricher(
      [engine("empty", empty), engine("hit", hit)],
      logger,
    );

    assertEquals(await enricher.enrichSync(PERSON), hit);
  },
});

Deno.test({
  name: "Thedig: enrichSync logs no PII and parses profile fields",
  ...noTimerSanitizers,
  async fn() {
    Deno.env.set("THEDIG_URL", "http://thedig.test");
    Deno.env.set("THEDIG_API_KEY", "test-key");
    const { logger, calls } = createSpyLogger();
    const restore = stubFetch(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            email: "pii@example.com",
            name: "Jane Doe",
            givenName: "Jane",
            familyName: "Doe",
            jobTitle: ["Engineer"],
            worksFor: ["Acme"],
            sameAs: ["https://example.com/jane"],
            homeLocation: "Paris",
            statusCode: 200,
          }),
          { status: 200 },
        ),
      )
    );

    try {
      const engine = new Thedig(logger);
      const result = await engine.enrichSync(PERSON);

      assertEquals(result.engine, "thedig");
      assertEquals(result.data.length, 1);
      assertEquals(result.data[0].email, "pii@example.com");
      assertEquals(result.data[0].jobTitle, "Engineer");
      assertEquals(result.data[0].organization, "Acme");
      assertEquals(result.data[0].givenName, "Jane");
      assertEquals(result.data[0].location, "Paris");
      assertNoPii(calls, ["pii@example.com", "Jane Doe"]);
    } finally {
      restore();
    }
  },
});

Deno.test({
  name: "Thedig: enrichSync drops non-authoritative empty results",
  ...noTimerSanitizers,
  async fn() {
    Deno.env.set("THEDIG_URL", "http://thedig.test");
    Deno.env.set("THEDIG_API_KEY", "test-key");
    const { logger } = createSpyLogger();
    const restore = stubFetch(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            email: "pii@example.com",
            name: "",
            givenName: "",
            statusCode: 203,
          }),
          { status: 200 },
        ),
      )
    );

    try {
      const engine = new Thedig(logger);
      const result = await engine.enrichSync(PERSON);
      assertEquals(result.data, []);
      assertEquals(result.engine, "thedig");
    } finally {
      restore();
    }
  },
});

Deno.test({
  name: "Thedig: API failures log safe error metadata",
  ...noTimerSanitizers,
  async fn() {
    Deno.env.set("THEDIG_URL", "http://thedig.test");
    Deno.env.set("THEDIG_API_KEY", "test-key");
    const { logger, calls } = createSpyLogger();
    const restore = stubFetch(() =>
      Promise.resolve(new Response("boom", { status: 500, statusText: "ERR" }))
    );

    try {
      const engine = new Thedig(logger);
      await assertRejects(
        () => engine.enrichSync(PERSON),
        Error,
        "TheDig API error: 500",
      );

      const errorCall = calls.find((call) => call.level === "error");
      assert(errorCall, "expected an error log");
      const meta = errorCall.context?.error as
        | { name?: string; message?: string }
        | undefined;
      assertEquals(meta?.name, "Error");
      assertStringIncludes(meta?.message ?? "", "TheDig API error: 500");
      assertNoPii(calls, ["pii@example.com", "Jane Doe"]);
    } finally {
      restore();
    }
  },
});

Deno.test({
  name: "Voilanorbert: enrichAsync logs counts, not contact payloads",
  ...noTimerSanitizers,
  async fn() {
    Deno.env.set("VOILANORBERT_URL", "http://voilanorbert.test");
    Deno.env.set("VOILANORBERT_USERNAME", "user");
    Deno.env.set("VOILANORBERT_API_KEY", "key");
    const { logger, calls } = createSpyLogger();
    const restore = stubFetch(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ token: "job-token", success: true, status: "ok" }),
          { status: 200 },
        ),
      )
    );

    try {
      const engine = new Voilanorbert(logger);
      const result = await engine.enrichAsync(
        [PERSON, { email: "second@example.com", name: "John Roe" }],
        "http://webhook.test",
      );

      assertEquals(result.token, "job-token");
      assertEquals(result.data, []);
      assertStringIncludes(
        calls.map((call) => call.message).join("\n"),
        "enrichAsync request for 2 persons",
      );
      assertNoPii(calls, [
        "pii@example.com",
        "Jane Doe",
        "second@example.com",
        "John Roe",
      ]);
    } finally {
      restore();
    }
  },
});

Deno.test({
  name: "Voilanorbert: upload failures log safe error metadata",
  ...noTimerSanitizers,
  async fn() {
    Deno.env.set("VOILANORBERT_URL", "http://voilanorbert.test");
    Deno.env.set("VOILANORBERT_USERNAME", "user");
    Deno.env.set("VOILANORBERT_API_KEY", "key");
    const { logger, calls } = createSpyLogger();
    const restore = stubFetch(() =>
      Promise.resolve(new Response("nope", { status: 502, statusText: "BAD" }))
    );

    try {
      const engine = new Voilanorbert(logger);
      await assertRejects(
        () => engine.enrichAsync([PERSON], "http://webhook.test"),
        Error,
        "Voilanorbert API error: 502",
      );

      const errorCall = calls.find((call) => call.level === "error");
      assert(errorCall, "expected an error log");
      const meta = errorCall.context?.error as
        | { name?: string; message?: string }
        | undefined;
      assertEquals(meta?.name, "Error");
      assertStringIncludes(meta?.message ?? "", "Voilanorbert API error: 502");
      assertNoPii(calls, ["pii@example.com", "Jane Doe"]);
    } finally {
      restore();
    }
  },
});

Deno.test({
  name: "EnrichLayer: enrichSync logs no PII and maps profile fields",
  ...noTimerSanitizers,
  async fn() {
    Deno.env.set("ENRICHLAYER_URL", "http://enrichlayer.test");
    Deno.env.set("ENRICHLAYER_API_KEY", "test-key");
    const { logger, calls } = createSpyLogger();
    const restore = stubFetch(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            profile: {
              full_name: "Jane Doe",
              first_name: "Jane",
              last_name: "Doe",
              occupation: "Engineer",
              profile_pic_url: "https://example.com/avatar.png",
              public_identifier: "jane-doe",
              city: "Paris",
              state: "IDF",
              country_full_name: "France",
              experiences: [{ company: "Acme" }],
              extra: { github_profile_id: "jane" },
            },
            last_updated: "2026-01-01",
            similarity_score: 0.9,
            linkedin_profile_url: "https://linkedin.com/in/jane",
            facebook_profile_url: "",
            twitter_profile_url: "",
          }),
          { status: 200 },
        ),
      )
    );

    try {
      const engine = new EnrichLayer(logger);
      const result = await engine.enrichSync(PERSON);

      assertEquals(result.engine, "enrichLayer");
      assertEquals(result.data.length, 1);
      assertEquals(result.data[0].email, "pii@example.com");
      assertEquals(result.data[0].givenName, "Jane");
      assertEquals(result.data[0].organization, "Acme");
      assertEquals(result.data[0].location, "Paris, IDF, France");
      assert(
        result.data[0].sameAs?.includes("https://github.com/jane"),
        "expected GitHub profile URL",
      );
      assertNoPii(calls, ["pii@example.com", "Jane Doe"]);
    } finally {
      restore();
    }
  },
});
