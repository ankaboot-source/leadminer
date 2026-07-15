import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Regression: large email campaigns used to throw "URI too long" because
// the PostgREST query string serialized the full email list as a single
// `?email=in.(...)` parameter. The fix batches the lookup into chunks.
//
// These tests exercise the batching behavior in isolation. They mock the
// Supabase admin client chain just enough to count `.in()` calls and to
// return canned rows.

const BATCH_SIZE = 100;

interface MockInCall {
  field: string;
  values: string[];
}

interface MockRow {
  email: string;
  consent_status: string;
  updated_at: string;
}

function createMockSupabaseAdmin(opts: {
  inCalls: MockInCall[];
  fromCalls: string[];
  rowsByValues?: Map<string, MockRow[]>;
  rows?: MockRow[];
  maxBatchSize?: number;
}) {
  const {
    inCalls,
    fromCalls,
    rowsByValues,
    rows,
    maxBatchSize = BATCH_SIZE,
  } = opts;
  const queryBuilder: Record<string, unknown> = {};
  queryBuilder.schema = () => queryBuilder;
  queryBuilder.from = (table: string) => {
    fromCalls.push(table);
    return queryBuilder;
  };
  queryBuilder.select = () => queryBuilder;
  queryBuilder.eq = () => queryBuilder;
  queryBuilder.in = (field: string, values: string[]) => {
    inCalls.push({ field, values });
    if (values.length > maxBatchSize) {
      // Simulate PostgREST rejecting oversized URL filters.
      throw new Error("URI too long");
    }
    return queryBuilder;
  };
  queryBuilder.order = () => queryBuilder;
  queryBuilder.then = (
    resolve: (val: { data: MockRow[]; error: null }) => void,
  ) => {
    let payload: MockRow[] = rows ?? [];
    if (rowsByValues) {
      const key = (inCalls[inCalls.length - 1]?.values ?? []).join(",");
      payload = rowsByValues.get(key) ?? [];
    }
    resolve({ data: payload, error: null });
  };

  return {
    schema: () => queryBuilder,
  };
}

Deno.test({
  name:
    "getSelectedContacts: batches large email lists into chunks to avoid URI too long",
  async fn() {
    const inCalls: MockInCall[] = [];
    const fromCalls: string[] = [];
    const supabaseAdmin = createMockSupabaseAdmin({
      inCalls,
      fromCalls,
      rows: [],
    });

    const { getSelectedContacts } = await import("../middlewares-mod.ts");

    const emails = Array.from(
      { length: 500 },
      (_, i) => `user${i}@example.com`,
    );

    // Must not throw.
    await getSelectedContacts(
      // deno-lint-ignore no-explicit-any
      supabaseAdmin as any,
      "user-id",
      emails,
    );

    // 500 / 100 = 5 chunks.
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
    const allQueried = inCalls.flatMap((c) => c.values).sort();
    assertEquals(
      allQueried,
      [...emails].sort(),
      "All input emails must appear in some batch",
    );
    assertEquals(
      fromCalls,
      [
        "contacts_view",
        "contacts_view",
        "contacts_view",
        "contacts_view",
        "contacts_view",
      ],
    );
  },
});

Deno.test({
  name: "getSelectedContacts: makes a single .in() call for small lists",
  async fn() {
    const inCalls: MockInCall[] = [];
    const fromCalls: string[] = [];
    const supabaseAdmin = createMockSupabaseAdmin({
      inCalls,
      fromCalls,
      rows: [],
    });

    const { getSelectedContacts } = await import("../middlewares-mod.ts");

    const emails = ["a@x.com", "b@x.com", "c@x.com"];
    await getSelectedContacts(
      // deno-lint-ignore no-explicit-any
      supabaseAdmin as any,
      "user-id",
      emails,
    );

    assertEquals(inCalls.length, 1);
    assertEquals(inCalls[0].field, "email");
    assertEquals(inCalls[0].values, emails);
  },
});

Deno.test({
  name:
    "getSelectedContacts: returns [] for empty input without calling the DB",
  async fn() {
    const inCalls: MockInCall[] = [];
    const fromCalls: string[] = [];
    const supabaseAdmin = createMockSupabaseAdmin({
      inCalls,
      fromCalls,
      rows: [],
    });

    const { getSelectedContacts } = await import("../middlewares-mod.ts");

    const contacts = await getSelectedContacts(
      // deno-lint-ignore no-explicit-any
      supabaseAdmin as any,
      "user-id",
      [],
    );

    assertEquals(contacts, []);
    assertEquals(inCalls.length, 0, "Empty input must not hit the DB");
  },
});
