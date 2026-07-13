import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Regression: /campaigns/preview used to throw "URI too long" on large
// contact lists because `getContactsByEmails` ran a single
// `.in("email", normalizedEmails)` query. The fix batches the email->id
// lookup into chunks of 100 (same as the compliance middleware fix).

const BATCH_SIZE = 100;

interface MockInCall {
  field: string;
  values: string[];
}

interface MockRow {
  id: string;
  email: string;
}

interface MockRpcCall {
  name: string;
  args: Record<string, unknown>;
}

// `index.ts` reads `SUPABASE_PROJECT_URL` at module-load time. Set it before
// the dynamic import so the module side-effects don't crash the test.
function loadIndexModule() {
  Deno.env.set("SUPABASE_PROJECT_URL", "https://test.example.com");
  return import("../index.ts");
}

function createMockSupabaseAdmin(opts: {
  inCalls: MockInCall[];
  rpcCalls: MockRpcCall[];
  personRowsByValues?: Map<string, MockRow[]>;
  rpcResult?: unknown[];
  maxBatchSize?: number;
}) {
  const {
    inCalls,
    rpcCalls,
    personRowsByValues,
    rpcResult = [],
    maxBatchSize = BATCH_SIZE,
  } = opts;

  const makeThenable = (data: unknown) => ({
    then: (
      resolve: (val: { data: unknown; error: null }) => void,
    ) => resolve({ data, error: null }),
  });

  const queryBuilder: Record<string, unknown> = {};
  queryBuilder.schema = () => queryBuilder;
  queryBuilder.from = () => queryBuilder;
  queryBuilder.select = () => queryBuilder;
  queryBuilder.eq = () => queryBuilder;
  queryBuilder.in = (field: string, values: string[]) => {
    inCalls.push({ field, values });
    if (values.length > maxBatchSize) {
      throw new Error("URI too long");
    }
    const data = personRowsByValues?.get(values.join(",")) ?? [];
    return makeThenable(data);
  };
  queryBuilder.order = () => queryBuilder;
  queryBuilder.rpc = (name: string, args: Record<string, unknown>) => {
    rpcCalls.push({ name, args });
    return makeThenable(rpcResult);
  };

  return {
    schema: () => queryBuilder,
  };
}

Deno.test({
  name:
    "getContactsByEmails: batches the email->id lookup to avoid URI too long",
  async fn() {
    const inCalls: MockInCall[] = [];
    const rpcCalls: MockRpcCall[] = [];
    const supabaseAdmin = createMockSupabaseAdmin({
      inCalls,
      rpcCalls,
      rpcResult: [],
    });

    const { getContactsByEmails } = await loadIndexModule();

    const emails = Array.from(
      { length: 500 },
      (_, i) => `user${i}@example.com`,
    );

    // Must not throw.
    await getContactsByEmails(
      // deno-lint-ignore no-explicit-any
      supabaseAdmin as any,
      "user-id",
      emails,
    );

    assertEquals(
      inCalls.length,
      5,
      `Expected 5 .in() calls for 500 emails, got ${inCalls.length}`,
    );
    assertEquals(
      inCalls.every((c) => c.values.length <= BATCH_SIZE),
      true,
      "Every batch must be <= 100 emails",
    );
  },
});

Deno.test({
  name:
    "getContactsByEmails: returns [] for empty input without hitting the DB",
  async fn() {
    const inCalls: MockInCall[] = [];
    const rpcCalls: MockRpcCall[] = [];
    const supabaseAdmin = createMockSupabaseAdmin({ inCalls, rpcCalls });

    const { getContactsByEmails } = await loadIndexModule();

    const contacts = await getContactsByEmails(
      // deno-lint-ignore no-explicit-any
      supabaseAdmin as any,
      "user-id",
      [],
    );

    assertEquals(contacts, []);
    assertEquals(inCalls.length, 0);
    assertEquals(rpcCalls.length, 0);
  },
});

Deno.test({
  name:
    "getContactsByEmails: dedupes and lowercases input emails before batching",
  async fn() {
    const inCalls: MockInCall[] = [];
    const rpcCalls: MockRpcCall[] = [];
    const supabaseAdmin = createMockSupabaseAdmin({ inCalls, rpcCalls });

    const { getContactsByEmails } = await loadIndexModule();

    await getContactsByEmails(
      // deno-lint-ignore no-explicit-any
      supabaseAdmin as any,
      "user-id",
      ["A@X.com", " a@x.com ", "b@x.com"],
    );

    assertEquals(inCalls.length, 1);
    assertEquals(inCalls[0].values, ["a@x.com", "b@x.com"]);
  },
});
