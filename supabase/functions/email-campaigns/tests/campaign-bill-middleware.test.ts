interface MockContext {
  req: {
    path: string;
    json?: () => Promise<Record<string, unknown>>;
  };
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
  json: (data: unknown, status?: number) => void;
}

Deno.test({
  name: "campaign-bill-middleware: should skip non-create paths",
  async fn() {
    const { campaignBillMiddleware } =
      await import("../campaign-bill-middleware.ts");

    let nextCalled = false;
    const context: MockContext = {
      req: { path: "/campaigns/list" },
      get: () => undefined,
      json: () => {},
    };

    await campaignBillMiddleware(context as any, () => {
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

    let jsonResult: Record<string, unknown> | undefined;
    const context: MockContext = {
      req: { path: "/campaigns/create" },
      get: () => undefined,
      json: (data: unknown, status?: number) => {
        jsonResult = { data: data as Record<string, unknown>, status };
      },
    };

    const originalEnv = Deno.env.get;
    Deno.env.get = (key: string) => {
      if (key === "ENABLE_BILLING") return "false";
      return originalEnv(key);
    };

    try {
      await campaignBillMiddleware(context as any, () => Promise.resolve());
    } finally {
      Deno.env.get = originalEnv;
    }

    if (!jsonResult || jsonResult.status !== 500) {
      throw new Error(`Expected 500, got: ${JSON.stringify(jsonResult)}`);
    }
    if (
      (jsonResult.data as Record<string, unknown>)?.error !==
      "Campaign creation data missing"
    ) {
      throw new Error(
        `Expected 'Campaign creation data missing', got: ${(jsonResult.data as Record<string, unknown>)?.error}`,
      );
    }
  },
});

Deno.test({
  name: "campaign-bill-middleware: should return success when billing disabled",
  async fn() {
    const { campaignBillMiddleware } =
      await import("../campaign-bill-middleware.ts");

    let jsonResult: Record<string, unknown> | undefined;
    const context: MockContext = {
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
      json: (data: unknown, status?: number) => {
        jsonResult = { data: data as Record<string, unknown>, status };
      },
    };

    const originalEnv = Deno.env.get;
    Deno.env.get = (key: string) => {
      if (key === "ENABLE_BILLING") return "false";
      return originalEnv(key);
    };

    try {
      await campaignBillMiddleware(context as any, () => Promise.resolve());
    } finally {
      Deno.env.get = originalEnv;
    }

    if (
      !jsonResult ||
      (jsonResult.data as Record<string, unknown>)?.msg !== "Campaign queued"
    ) {
      throw new Error(
        `Expected success response, got: ${JSON.stringify(jsonResult)}`,
      );
    }
    if (
      (jsonResult.data as Record<string, unknown>)?.campaignId !==
      "campaign-123"
    ) {
      throw new Error(
        `Expected campaignId 'campaign-123', got: ${(jsonResult.data as Record<string, unknown>)?.campaignId}`,
      );
    }
    if ((jsonResult.data as Record<string, unknown>)?.queuedCount !== 10) {
      throw new Error(
        `Expected queuedCount 10, got: ${(jsonResult.data as Record<string, unknown>)?.queuedCount}`,
      );
    }
  },
});

Deno.test({
  name: "campaign-bill-middleware: should return success when charge fails (campaign exists)",
  async fn() {
    const { campaignBillMiddleware } =
      await import("../campaign-bill-middleware.ts");

    let jsonResult: Record<string, unknown> | undefined;
    const context: MockContext = {
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
      json: (data: unknown, status?: number) => {
        jsonResult = { data: data as Record<string, unknown>, status };
      },
    };

    const originalEnv = Deno.env.get;
    Deno.env.get = (key: string) => {
      if (key === "ENABLE_BILLING") return "true";
      return originalEnv(key);
    };

    try {
      await campaignBillMiddleware(context as any, () => Promise.resolve());
    } finally {
      Deno.env.get = originalEnv;
    }

    if (
      !jsonResult ||
      (jsonResult.data as Record<string, unknown>)?.msg !== "Campaign queued"
    ) {
      throw new Error(
        `Expected success response even when billing fails, got: ${JSON.stringify(jsonResult)}`,
      );
    }
    if (
      (jsonResult.data as Record<string, unknown>)?.campaignId !==
      "campaign-456"
    ) {
      throw new Error(
        `Expected campaignId 'campaign-456', got: ${(jsonResult.data as Record<string, unknown>)?.campaignId}`,
      );
    }
  },
});
