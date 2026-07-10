import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  getSenderCredentialIssue,
  listUniqueSenderSources,
} from "./sender-options.ts";

Deno.test("listUniqueSenderSources keeps distinct sender emails", () => {
  const sources = [
    { email: "bader.lejmi@gmail.com", type: "google", credentials: {} },
    { email: "sales@acme.io", type: "imap", credentials: {} },
    { email: "BADER.LEJMI@gmail.com", type: "google", credentials: {} },
  ];

  const result = listUniqueSenderSources(sources);
  assertEquals(result.length, 2);
  assertEquals(result[0].email, "bader.lejmi@gmail.com");
  assertEquals(result[1].email, "sales@acme.io");
});

Deno.test("getSenderCredentialIssue flags expired OAuth token", () => {
  const issue = getSenderCredentialIssue(
    {
      email: "bader.lejmi@gmail.com",
      type: "google",
      credentials: { expiresAt: 1000 },
    },
    2000,
  );

  assertEquals(
    issue,
    "OAuth token expired. Please reconnect this account in sources.",
  );
});

// Regression test for Fix 1: the `get_contacts_table` RPC must be invoked
// with the parameter name `p_user_id` (matching the Supabase function
// signature). Using the bare `user_id` key would cause a PGRST202 error
// at runtime ("Could not find the function ... with parameters ... types
// ..."). This test reads the source of `index.ts` to assert the call
// site uses `p_user_id:`, protecting against future regressions of the
// exact bug fixed in this lane.
Deno.test(
  "get_contacts_table RPC is invoked with p_user_id (Fix 1 regression)",
  async () => {
    const source = await Deno.readTextFile(
      new URL("./index.ts", import.meta.url),
    );
    const callMatch = source.match(
      /\.rpc\(\s*["']get_contacts_table["']\s*,\s*\{([^}]*)\}\s*\)/,
    );
    assertExists(
      callMatch,
      'Expected to find `.rpc("get_contacts_table", { ... })` in index.ts',
    );
    const args = callMatch[1].trim();
    // The argument object must use the `p_` prefix.
    assertEquals(
      args.startsWith("p_user_id:"),
      true,
      `get_contacts_table RPC must use p_user_id: as the argument name (got: ${args})`,
    );
    // Guard against a regression that uses the bare `user_id:` key
    // (which would be a substring match inside `p_user_id:`, so we
    // require a non-identifier char before `user_id`).
    assertEquals(
      /(^|[^_a-zA-Z])user_id\s*:/.test(args),
      false,
      `get_contacts_table RPC must not use bare user_id: (got: ${args})`,
    );
  },
);

// Same regression guard for the second RPC call site (`get_contacts_table_by_ids`),
// which has the same parameter-naming requirement.
Deno.test(
  "get_contacts_table_by_ids RPC is invoked with p_user_id (Fix 1 regression)",
  async () => {
    const source = await Deno.readTextFile(
      new URL("./index.ts", import.meta.url),
    );
    const callMatch = source.match(
      /\.rpc\(\s*["']get_contacts_table_by_ids["']\s*,\s*\{([\s\S]*?)\}\s*\)/,
    );
    assertExists(
      callMatch,
      'Expected to find `.rpc("get_contacts_table_by_ids", { ... })` in index.ts',
    );
    const args = callMatch[1];
    assertEquals(
      /p_user_id\s*:/.test(args),
      true,
      `get_contacts_table_by_ids RPC must include p_user_id: parameter (got: ${args})`,
    );
    // Guard against a regression that uses the bare `user_id:` key
    // at the start of a line.
    assertEquals(
      /(^|\n)\s*user_id\s*:/m.test(args),
      false,
      `get_contacts_table_by_ids RPC must not use bare user_id: (got: ${args})`,
    );
  },
);
