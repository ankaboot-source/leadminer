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
  name: "campaign-bill-middleware: should return success when charge fails (campaign exists)",
  async fn() {
    const { campaignBillMiddleware } =
      await import("../campaign-bill-middleware.ts");

    let jsonResult: any;
    const context: any = {
      req: { path: "/campaigns/create" },
      get: (key: string) => {
        if (key === "campaignCreate") {
          return {
            campaignId: "campaign-456",
            createdCount: 25,
            userId: "user-456",
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
      if (key === "ENABLE_BILLING") return "true";
      return originalEnv(key);
    };

    try {
      await campaignBillMiddleware(context, () => Promise.resolve());
    } finally {
      Deno.env.get = originalEnv;
    }

    if (!jsonResult || jsonResult.data.msg !== "Campaign queued") {
      throw new Error(
        `Expected success response even when billing fails, got: ${JSON.stringify(jsonResult)}`,
      );
    }
    if (jsonResult.data.campaignId !== "campaign-456") {
      throw new Error(
        `Expected campaignId 'campaign-456', got: ${jsonResult.data.campaignId}`,
      );
    }
  },
});
