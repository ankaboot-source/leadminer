import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";
import type { Logger } from "../../_shared/logger.ts";
import type { EngineResponse } from "./engine.ts";
import EnrichmentsClient from "./enrichments-client.ts";
import {
  enrichFromCache,
  getContactsToEnrich,
  getEnrichmentCache,
} from "./enrichment-helpers.ts";

interface FakeClientOptions {
  refinedPersons: Array<{ person_id: string }>;
  persons: Record<string, { id: string; email: string; name?: string }>;
  refinedError?: { message: string } | null;
  personsError?: { message: string } | null;
}

/**
 * Minimal chainable stub for the PostgREST calls used by
 * `getContactsToEnrich`. Captures the `.in()` chunks so tests can assert
 * the backend's 150-id chunking was ported to the edge function.
 */
function createFakeClient(options: FakeClientOptions) {
  const inCalls: string[][] = [];
  let table = "";

  const api = {
    schema(_name: string) {
      return api;
    },
    from(name: string) {
      table = name;
      return api;
    },
    select(_columns?: string) {
      return api;
    },
    eq(_column: string, _value: string) {
      if (table === "refinedpersons") {
        return Promise.resolve({
          data: options.refinedPersons,
          error: options.refinedError ?? null,
        });
      }
      return api;
    },
    in(_column: string, values: string[]) {
      inCalls.push([...values]);
      const error = options.personsError ?? null;
      const data = error
        ? null
        : values
          .map((id) => options.persons[id])
          .filter((person): person is NonNullable<typeof person> =>
            Boolean(person)
          );
      return Promise.resolve({ data, error });
    },
  };

  return { client: api as unknown as SupabaseClient, inCalls };
}

function createSpyLogger() {
  const errors: Array<{ message: string; context?: Record<string, unknown> }> =
    [];
  const logger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: (message: string, context?: Record<string, unknown>) => {
      errors.push({ message, context });
    },
  };
  return { logger: logger as unknown as Logger, errors };
}

Deno.test("getContactsToEnrich: chunks person ids to keep request URIs short", async () => {
  const refinedPersons = Array.from({ length: 320 }, (_, index) => ({
    person_id: `person-${index}`,
  }));
  const persons = Object.fromEntries(
    refinedPersons.map(({ person_id }, index) => [
      person_id,
      {
        id: person_id,
        email: `contact-${index}@example.com`,
        name: `Contact ${index}`,
      },
    ]),
  );

  const { client, inCalls } = createFakeClient({ refinedPersons, persons });

  const contacts = await getContactsToEnrich(client, "user-1");

  assertEquals(contacts.length, 320);
  assertEquals(inCalls.length, 3);
  assertEquals(inCalls.map((chunk) => chunk.length), [150, 150, 20]);
  assertEquals(contacts[0].email, "contact-0@example.com");
});

Deno.test("getContactsToEnrich: returns [] when the user has no refined persons", async () => {
  const { client, inCalls } = createFakeClient({
    refinedPersons: [],
    persons: {},
  });

  assertEquals(await getContactsToEnrich(client, "user-1"), []);
  assertEquals(inCalls.length, 0);
});

Deno.test("getContactsToEnrich: surfaces refinedpersons query errors", async () => {
  const { client } = createFakeClient({
    refinedPersons: [],
    persons: {},
    refinedError: { message: "refinedpersons unavailable" },
  });

  await assertRejects(
    () => getContactsToEnrich(client, "user-1"),
    Error,
    "refinedpersons unavailable",
  );
});

Deno.test("getContactsToEnrich: surfaces persons query errors", async () => {
  const { client } = createFakeClient({
    refinedPersons: [{ person_id: "person-1" }],
    persons: {},
    personsError: { message: "persons unavailable" },
  });

  await assertRejects(
    () => getContactsToEnrich(client, "user-1"),
    Error,
    "persons unavailable",
  );
});

Deno.test("getEnrichmentCache: returns cached rows and the cached email set", async () => {
  const rows = [
    { task_id: "t1", user_id: "u1", engine: "thedig", result: { email: "a@b.c" } },
    { task_id: "t2", user_id: "u1", engine: "thedig", result: { email: "d@e.f" } },
    { task_id: "t3", user_id: "u1", engine: "thedig", result: "not-an-object" },
  ];

  const client = {
    schema: () => ({
      rpc: () => Promise.resolve({ data: rows, error: null }),
    }),
  } as unknown as SupabaseClient;
  const { logger } = createSpyLogger();

  const { cachedResults, cachedEmails } = await getEnrichmentCache(
    client,
    ["a@b.c", "d@e.f"],
    logger,
  );

  assertEquals(cachedResults, rows);
  assertEquals([...cachedEmails].sort(), ["a@b.c", "d@e.f"]);
});

Deno.test("getEnrichmentCache: never throws when the RPC fails", async () => {
  const client = {
    schema: () => ({
      rpc: () =>
        Promise.resolve({
          data: null,
          error: Object.assign(new Error("rpc down"), { code: "XX000" }),
        }),
    }),
  } as unknown as SupabaseClient;
  const { logger, errors } = createSpyLogger();

  const { cachedResults, cachedEmails } = await getEnrichmentCache(
    client,
    ["a@b.c"],
    logger,
  );

  assertEquals(cachedResults, []);
  assertEquals(cachedEmails.size, 0);
  assertEquals(errors.length, 1);
  assertEquals(errors[0].message, "Cache check failed");
  assertEquals(
    (errors[0].context?.error as { message?: string } | undefined)?.message,
    "rpc down",
  );
});

interface EnrichmentsFakeOptions {
  rpcRows?: Array<{ id: string }>;
  rpcError?: { message: string } | null;
}

/**
 * Minimal Supabase stub for the real `EnrichmentsClient`: supports the
 * `tasks` insert/update chain, the `engagement` upsert, and records the
 * `enrich_contacts` RPC payload so tests can assert the exact shape sent
 * to the database.
 */
function createEnrichmentsFakeClient(options: EnrichmentsFakeOptions = {}) {
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const engagementUpserts: unknown[] = [];
  const baseTask = {
    id: "task-1",
    user_id: "user-1",
    type: "enrich",
    category: "enriching",
    status: "running",
    details: {
      result: [],
      total_enriched: 0,
      total_to_enrich: 1,
      update_empty_fields_only: true,
    },
  };
  let table = "";
  let pendingRow: Record<string, unknown> | null = null;

  const api = {
    schema(_name: string) {
      return api;
    },
    from(name: string) {
      table = name;
      return api;
    },
    insert(row: Record<string, unknown>) {
      pendingRow = row;
      return api;
    },
    update(row: Record<string, unknown>) {
      pendingRow = row;
      return api;
    },
    select() {
      return api;
    },
    eq() {
      return api;
    },
    single() {
      if (table === "tasks") {
        return Promise.resolve({
          data: { ...baseTask, ...(pendingRow ?? {}) },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    },
    upsert(rows: unknown) {
      engagementUpserts.push(rows);
      return Promise.resolve({ error: null });
    },
    rpc(fn: string, args: Record<string, unknown>) {
      rpcCalls.push({ fn, args });
      return Promise.resolve({
        data: options.rpcRows ?? [{ id: "person-1" }],
        error: options.rpcError ?? null,
      });
    },
  };

  return {
    client: api as unknown as SupabaseClient,
    rpcCalls,
    engagementUpserts,
  };
}

const cachedRow = {
  task_id: "t1",
  user_id: "user-1",
  engine: "thedig",
  result: {
    email: "a@b.c",
    givenName: "Jane",
    familyName: "Doe",
    jobTitle: "Engineer",
    worksFor: ["Acme"],
    sameAs: ["https://a", "https://b"],
  },
};

function fakeParse(_result: unknown[], engine: string): EngineResponse {
  return {
    engine,
    data: [{
      email: "a@b.c",
      givenName: "Jane",
      familyName: "Doe",
      jobTitle: "Engineer",
      organization: "Acme",
      sameAs: ["https://a", "https://b"],
    }],
    raw_data: [],
  };
}

Deno.test("enrichFromCache: writes via EnrichmentsClient with user_id, id and snake_case keys", async () => {
  const { client, rpcCalls, engagementUpserts } =
    createEnrichmentsFakeClient();
  const { logger } = createSpyLogger();
  const enrichments = new EnrichmentsClient(client, logger);
  await enrichments.create("user-1", 1, true);

  const writtenIds = await enrichFromCache(
    enrichments,
    [cachedRow],
    [{ email: "a@b.c", id: "person-1" }],
    logger,
    fakeParse,
  );

  assertEquals(writtenIds, ["person-1"]);
  assertEquals(rpcCalls.length, 1);
  assertEquals(rpcCalls[0].fn, "enrich_contacts");

  const payload = rpcCalls[0].args.p_contacts_data as Array<
    Record<string, unknown>
  >;
  assertEquals(payload.length, 1);
  assertEquals(payload[0].id, "person-1");
  assertEquals(payload[0].user_id, "user-1");
  assertEquals(payload[0].given_name, "Jane");
  assertEquals(payload[0].family_name, "Doe");
  assertEquals(payload[0].job_title, "Engineer");
  assertEquals(payload[0].works_for, "Acme");
  assertEquals(payload[0].same_as, "https://a,https://b");
  assertEquals(rpcCalls[0].args.p_update_empty_fields_only, true);

  assertEquals(engagementUpserts.length, 1);
  assertEquals(engagementUpserts[0], [{
    person_id: "person-1",
    user_id: "user-1",
    engagement_type: "ENRICH",
    service: "cache",
  }]);
});

Deno.test("enrichFromCache: returns [] when the RPC wrote no contacts", async () => {
  const { client, engagementUpserts } = createEnrichmentsFakeClient({
    rpcRows: [],
  });
  const { logger } = createSpyLogger();
  const enrichments = new EnrichmentsClient(client, logger);
  await enrichments.create("user-1", 1, true);

  const writtenIds = await enrichFromCache(
    enrichments,
    [cachedRow],
    [{ email: "a@b.c", id: "person-1" }],
    logger,
    fakeParse,
  );

  assertEquals(writtenIds, []);
  assertEquals(engagementUpserts.length, 0);
});

Deno.test("enrichFromCache: survives a parser failure without writing", async () => {
  const { client, rpcCalls } = createEnrichmentsFakeClient();
  const { logger, errors } = createSpyLogger();
  const enrichments = new EnrichmentsClient(client, logger);
  await enrichments.create("user-1", 1, true);

  const writtenIds = await enrichFromCache(
    enrichments,
    [cachedRow],
    [{ email: "a@b.c", id: "person-1" }],
    logger,
    () => {
      throw new Error("bad cache payload");
    },
  );

  assertEquals(writtenIds, []);
  assertEquals(rpcCalls.length, 0);
  assertEquals(
    errors.some((e) => e.message === "Failed to parse cached enrichment"),
    true,
  );
});
