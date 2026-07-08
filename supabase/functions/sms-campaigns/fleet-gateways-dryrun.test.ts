import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

// Regression test for the bug where `POST /fleet/gateways?dryRun=true`
// on the `sms-campaigns` edge function silently ignored the query
// param and inserted a real gateway, instead of returning the
// discovered schema.
//
// The fix adds a `c.req.query("dryRun") === "true"` short-circuit
// between the `finalConfig.bodySchema` assignment and the
// `.from("sms_fleet_gateways").insert(...)` call. This test reads the
// source and asserts the structure is in place.
Deno.test(
  "sms-campaigns POST /fleet/gateways short-circuits on ?dryRun=true (regression)",
  async () => {
    const source = await Deno.readTextFile(
      new URL("./index.ts", import.meta.url),
    );

    // Find the `app.post("/fleet/gateways", ...)` handler body.
    // We anchor on the literal route string so this only matches the
    // intended handler and not a comment or other POST route.
    const handlerStart = source.indexOf(
      'app.post("/fleet/gateways", authMiddleware, async (c: Context) =>',
    );
    assertExists(
      handlerStart,
      "Expected to find POST /fleet/gateways handler in sms-campaigns/index.ts",
    );

    // The dryRun short-circuit must appear AFTER `finalConfig.bodySchema`
    // is assigned (so the preview includes the discovered schema) and
    // BEFORE the `.from("sms_fleet_gateways").insert(` call (so the
    // gateway is never persisted in dryRun mode).
    const bodySchemaAssignment = source.indexOf(
      "finalConfig.bodySchema = discoveredSchema",
      handlerStart,
    );
    const insertCall = source.indexOf(
      '.from("sms_fleet_gateways")',
      handlerStart,
    );
    const dryRunCheck = source.indexOf(
      'c.req.query("dryRun") === "true"',
      handlerStart,
    );

    assertExists(
      bodySchemaAssignment,
      "Expected `finalConfig.bodySchema = discoveredSchema` in the handler",
    );
    assertExists(
      insertCall,
      'Expected `.from("sms_fleet_gateways").insert(...)` in the handler',
    );
    assertExists(
      dryRunCheck,
      'Expected `c.req.query("dryRun") === "true"` check in the handler',
    );

    // Ordering: bodySchema assignment < dryRun check < insert call
    assertEquals(
      bodySchemaAssignment < dryRunCheck,
      true,
      "dryRun check must come AFTER finalConfig.bodySchema is set",
    );
    assertEquals(
      dryRunCheck < insertCall,
      true,
      "dryRun check must come BEFORE the .from(...).insert(...) call",
    );

    // The dryRun branch must return a JSON body with a
    // `discoveredSchema` field — that's what the frontend store reads.
    // Grab the line after the dryRun check to verify the return shape.
    const dryRunReturnSlice = source.slice(dryRunCheck, dryRunCheck + 800);
    assertEquals(
      /discoveredSchema\s*:/.test(dryRunReturnSlice),
      true,
      "dryRun branch must return an object with a `discoveredSchema` field",
    );
    assertEquals(
      /reachabilityTest\s*:/.test(dryRunReturnSlice),
      true,
      "dryRun branch must return a `reachabilityTest` field",
    );

    // The dryRun branch must `return` — not fall through to insert.
    // Find the first `return c.json(` after the dryRun check and
    // confirm there's no `.from(` or `.insert(` between the dryRun
    // check and that return.
    const dryRunBranchSource = source.slice(dryRunCheck, dryRunCheck + 1500);
    const returnIndex = dryRunBranchSource.indexOf("return c.json(");
    assertExists(
      returnIndex >= 0 && returnIndex < 500,
      "dryRun branch must return c.json(...) shortly after the check",
    );
    const branchBody = dryRunBranchSource.slice(0, returnIndex + 200);
    assertEquals(
      /\.from\(/.test(branchBody),
      false,
      "dryRun branch must not call .from() before returning",
    );
    assertEquals(
      /\.insert\(/.test(branchBody),
      false,
      "dryRun branch must not call .insert() before returning",
    );
  },
);

// Mirror test for the `sms-fleet` edge function so both fleet-gateway
// POST routes are kept in sync. If the query-string check is removed
// from either function, this test fires on the affected side.
Deno.test(
  "sms-fleet POST /gateways short-circuits on ?dryRun=true (parity with sms-campaigns)",
  async () => {
    const source = await Deno.readTextFile(
      new URL("../sms-fleet/index.ts", import.meta.url),
    );
    assertExists(
      source.indexOf('c.req.query("dryRun") === "true"'),
      "sms-fleet must also have the dryRun short-circuit",
    );
    assertExists(
      source.indexOf("discoveredSchema:"),
      "sms-fleet dryRun branch must return discoveredSchema",
    );
  },
);
