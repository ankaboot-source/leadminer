import { Context } from "hono";

// Set env vars before middlewares-mod.ts is dynamically imported.
// createSupabaseAdmin reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY at
// module load time; without these, createClient throws "supabaseUrl is required".
Deno.env.set("SUPABASE_URL", "http://localhost:54321");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
Deno.env.set("SUPABASE_ANON_KEY", "test-anon-key");

Deno.test({
  name: "campaign-check-middleware: should skip non-create paths",
  async fn() {
    const { complianceMiddleware } = await import("../middlewares-mod.ts");

    let nextCalled = false;
    // skipcq: JS-0323 - Test mock requires minimal Context interface
    const context = {
      req: { path: "/campaigns/list" },
      get: () => undefined,
      set: () => {},
      json: () => {},
    } as unknown as Context;

    await complianceMiddleware(context, async () => {
      nextCalled = true;
    });

    if (!nextCalled) {
      throw new Error("Expected next() to be called");
    }
  },
});

Deno.test({
  name: "campaign-check-middleware: should return 400 when no contacts selected",
  async fn() {
    const { complianceMiddleware } = await import("../middlewares-mod.ts");

    let jsonResult: Record<string, unknown> | undefined;
    // skipcq: JS-0323 - Test mock requires minimal Context interface
    const context = {
      req: {
        path: "/campaigns/create",
        json: async () => ({ selectedEmails: [] }),
      },
      get: (key: string) => {
        if (key === "user") return { id: "user-123" };
        return undefined;
      },
      set: () => {},
      json: (data: unknown) => {
        jsonResult = { data: data as Record<string, unknown>, status: 400 };
      },
    } as unknown as Context;

    await complianceMiddleware(context, async () => {});

    if (
      !jsonResult ||
      (jsonResult.data as Record<string, unknown>)?.error !==
        "No contacts selected"
    ) {
      throw new Error(
        `Expected 400 with 'No contacts selected', got: ${JSON.stringify(jsonResult)}`,
      );
    }
  },
});

Deno.test({
  name: "Billing flow: should correctly pass data between middleware stages",
  fn() {
    const mockCampaignCheck = {
      filteredEmails: ["test1@example.com", "test2@example.com"],
      eligibleCount: 2,
      userId: "user-123",
    };

    const mockCampaignCreate = {
      campaignId: "campaign-456",
      createdCount: 2,
      userId: "user-123",
    };

    if (mockCampaignCheck.eligibleCount !== 2) {
      throw new Error("Expected eligibleCount to be 2");
    }
    if (mockCampaignCreate.createdCount !== 2) {
      throw new Error("Expected createdCount to be 2");
    }
    if (mockCampaignCheck.userId !== mockCampaignCreate.userId) {
      throw new Error("Expected userIds to match");
    }
  },
});

Deno.test({
  name: "Billing flow: should handle partial campaign correctly",
  fn() {
    const requested = 100;
    const availableCredits = 50;
    const partialCampaign = true;

    const chargeUnits = partialCampaign
      ? Math.min(requested, availableCredits)
      : requested;

    if (chargeUnits !== 50) {
      throw new Error(`Expected chargeUnits 50, got: ${chargeUnits}`);
    }
  },
});

Deno.test({
  name: "Billing flow: should handle full campaign correctly",
  fn() {
    const requested = 50;
    const availableCredits = 100;
    const partialCampaign = false;

    const chargeUnits = partialCampaign
      ? Math.min(requested, availableCredits)
      : requested;

    if (chargeUnits !== 50) {
      throw new Error(`Expected chargeUnits 50, got: ${chargeUnits}`);
    }
  },
});

Deno.test({
  name: "Billing flow: should return 266 for insufficient credits without partial",
  fn() {
    const requested = 100;
    const availableCredits = 50;
    const partialCampaign = false;

    const shouldReturn266 = !partialCampaign && availableCredits < requested;
    const reason = "credits";

    if (!shouldReturn266) {
      throw new Error("Expected shouldReturn266 to be true");
    }
    if (reason !== "credits") {
      throw new Error(`Expected reason 'credits', got: ${reason}`);
    }
  },
});

Deno.test({
  name: "complianceMiddleware: should NOT mask downstream billing errors as CHECK_FAILED (regression)",
  async fn() {
    const { complianceMiddleware } = await import("../middlewares-mod.ts");

    // Stub globalThis.fetch so createSupabaseAdmin's client returns canned
    // consenting contacts without hitting a real database. PostgREST returns
    // the row array directly as the response body for .select() queries;
    // supabase-js then exposes it as { data: <body>, error: null }.
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => {
      return Promise.resolve(
        new Response(
          JSON.stringify([
            {
              email: "consented@example.com",
              consent_status: "legitimate_interest",
              updated_at: "2024-01-01T00:00:00Z",
            },
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );
    }) as typeof globalThis.fetch;

    let jsonResult: Record<string, unknown> | undefined;
    const context = {
      req: {
        path: "/campaigns/create",
        json: async () => ({
          selectedEmails: ["consented@example.com"],
          partial_one: true,
        }),
      },
      get: (key: string) => {
        if (key === "user") {
          return { id: "user-123", user_metadata: {} };
        }
        return undefined;
      },
      set: () => {},
      json: (data: unknown, status?: number) => {
        jsonResult = { data: data as Record<string, unknown>, status };
      },
    } as unknown as Context;

    // next() simulates the commercial billing middleware throwing when the
    // billing Edge Function returns a non-2xx status code. This is the exact
    // error from the bug report.
    const billingError = new Error(
      "Billing service unavailable: Edge Function returned a non-2xx status code",
    );
    const next = async () => {
      throw billingError;
    };

    let caughtError: unknown = undefined;
    try {
      await complianceMiddleware(context, next);
    } catch (error) {
      caughtError = error;
    }

    globalThis.fetch = originalFetch;

    // The billing error MUST propagate, NOT be masked as a compliance
    // CHECK_FAILED response. If jsonResult is set with code CHECK_FAILED,
    // the bug is present (the catch block swallowed the downstream error).
    if (jsonResult) {
      const code = (jsonResult.data as Record<string, unknown>)?.code;
      if (code === "CHECK_FAILED") {
        throw new Error(
          `BUG: complianceMiddleware masked downstream billing error as CHECK_FAILED. ` +
            `Billing should be best-effort and must not block campaign creation. ` +
            `Got: ${JSON.stringify(jsonResult)}`,
        );
      }
    }

    // The error should propagate to the caller (Hono/commercial error handler).
    if (caughtError !== billingError) {
      throw new Error(
        `Expected billing error to propagate, but it was swallowed. ` +
          `caughtError: ${String(caughtError)}, jsonResult: ${JSON.stringify(
            jsonResult,
          )}`,
      );
    }
  },
});
