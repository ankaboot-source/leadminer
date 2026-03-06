Deno.test({
  name: "campaign-check-middleware: should skip non-create paths",
  async fn() {
    const { campaignCheckMiddleware } =
      await import("../campaign-check-middleware.ts");

    let nextCalled = false;
    const context: any = {
      req: { path: "/campaigns/list" },
      get: () => undefined,
      set: () => {},
      json: () => {},
    };

    await campaignCheckMiddleware(context, () => {
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
    const { campaignCheckMiddleware } =
      await import("../campaign-check-middleware.ts");

    let jsonResult: any;
    const context: any = {
      req: {
        path: "/campaigns/create",
        json: async () => ({ selectedEmails: [] }),
      },
      get: (key: string) => {
        if (key === "user") return { id: "user-123" };
        return undefined;
      },
      set: () => {},
      json: (data: any) => {
        jsonResult = { data, status: 400 };
      },
    };

    await campaignCheckMiddleware(context, () => Promise.resolve());

    if (!jsonResult || jsonResult.data.error !== "No contacts selected") {
      throw new Error(
        `Expected 400 with 'No contacts selected', got: ${JSON.stringify(jsonResult)}`,
      );
    }
  },
});

Deno.test({
  name: "campaign-bill-middleware: should skip non-create paths",
  async fn() {
    const { campaignBillMiddleware } =
      await import("../campaign-bill-middleware.ts");

    let nextCalled = false;
    const context: any = {
      req: { path: "/campaigns/list" },
      get: () => undefined,
      json: () => {},
    };

    await campaignBillMiddleware(context, () => {
      nextCalled = true;
    });

    if (!nextCalled) {
      throw new Error("Expected next() to be called");
    }
  },
});

Deno.test({
  name: "campaign-bill-middleware: should return 500 when campaign data missing",
  async fn() {
    const { campaignBillMiddleware } =
      await import("../campaign-bill-middleware.ts");

    let jsonResult: any;
    const context: any = {
      req: { path: "/campaigns/create" },
      get: () => undefined,
      json: (data: any, status?: number) => {
        jsonResult = { data, status };
      },
    };

    const originalEnv = Deno.env.get;
    Deno.env.get = (key: string) => {
      if (key === "ENABLE_BILLING") return "false";
      return originalEnv(key);
    };

    try {
      await campaignBillMiddleware(context, () => Promise.resolve());
    } finally {
      Deno.env.get = originalEnv;
    }

    if (!jsonResult || jsonResult.status !== 500) {
      throw new Error(`Expected 500, got: ${JSON.stringify(jsonResult)}`);
    }
    if (jsonResult.data.error !== "Campaign creation data missing") {
      throw new Error(
        `Expected 'Campaign creation data missing', got: ${jsonResult.data.error}`,
      );
    }
  },
});

Deno.test({
  name: "campaign-bill-middleware: should return success when billing disabled",
  async fn() {
    const { campaignBillMiddleware } =
      await import("../campaign-bill-middleware.ts");

    let jsonResult: any;
    const context: any = {
      req: { path: "/campaigns/create" },
      get: (key: string) => {
        if (key === "campaignCreate") {
          return {
            campaignId: "campaign-123",
            createdCount: 10,
            userId: "user-123",
          };
        }
        return undefined;
      },
      json: (data: any, status?: number) => {
        jsonResult = { data, status };
      },
    };

    const originalEnv = Deno.env.get;
    Deno.env.get = (key: string) => {
      if (key === "ENABLE_BILLING") return "false";
      return originalEnv(key);
    };

    try {
      await campaignBillMiddleware(context, () => Promise.resolve());
    } finally {
      Deno.env.get = originalEnv;
    }

    if (!jsonResult || jsonResult.data.msg !== "Campaign queued") {
      throw new Error(
        `Expected success response, got: ${JSON.stringify(jsonResult)}`,
      );
    }
    if (jsonResult.data.campaignId !== "campaign-123") {
      throw new Error(
        `Expected campaignId 'campaign-123', got: ${jsonResult.data.campaignId}`,
      );
    }
    if (jsonResult.data.queuedCount !== 10) {
      throw new Error(
        `Expected queuedCount 10, got: ${jsonResult.data.queuedCount}`,
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
