import { Context } from "hono";

Deno.test({
  name: "campaign-bill-middleware: should skip non-create paths",
  async fn() {
    const { campaignBillMiddleware } =
      await import("../campaign-bill-middleware.ts");

    let nextCalled = false;
    // skipcq: JS-0323 - Test mock requires minimal Context interface
    const context = {
      req: { path: "/campaigns/list" },
      get: () => undefined,
      set: () => {},
      json: () => {},
    } as unknown as Context;

    await campaignBillMiddleware(context, async () => {
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
    // skipcq: JS-0323 - Test mock requires minimal Context interface
    const context = {
      req: { path: "/campaigns/create" },
      get: () => undefined,
      set: () => {},
      json: (data: unknown, status?: number) => {
        jsonResult = { data: data as Record<string, unknown>, status };
      },
    } as unknown as Context;

    const originalEnv = Deno.env.get;
    Deno.env.get = (key: string) => {
      if (key === "ENABLE_CREDIT") return "false";
      return originalEnv(key);
    };

    try {
      await campaignBillMiddleware(context, async () => {});
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
    // skipcq: JS-0323 - Test mock requires minimal Context interface
    const context = {
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
      set: () => {},
      json: (data: unknown, status?: number) => {
        jsonResult = { data: data as Record<string, unknown>, status };
      },
    } as unknown as Context;

    const originalEnv = Deno.env.get;
    Deno.env.get = (key: string) => {
      if (key === "ENABLE_CREDIT") return "false";
      return originalEnv(key);
    };

    try {
      await campaignBillMiddleware(context, async () => {});
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
    // skipcq: JS-0323 - Test mock requires minimal Context interface
    const context = {
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
      set: () => {},
      json: (data: unknown, status?: number) => {
        jsonResult = { data: data as Record<string, unknown>, status };
      },
    } as unknown as Context;

    const originalEnv = Deno.env.get;
    Deno.env.get = (key: string) => {
      if (key === "ENABLE_CREDIT") return "true";
      return originalEnv(key);
    };

    try {
      await campaignBillMiddleware(context, async () => {});
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
