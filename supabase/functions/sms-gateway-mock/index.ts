import { Context, Hono } from "hono";
import { z } from "zod";
import { createLogger } from "../_shared/logger.ts";
import corsHeaders from "../_shared/cors.ts";
import { defaultConfig, type MockConfig } from "./config.ts";

const logger = createLogger("sms-gateway-mock");

const PORT = parseInt(Deno.env.get("PORT") ?? "8000", 10);

const sendSmsSchema = z.object({
  phone: z.string().min(1, "Phone number is required"),
  message: z.string().min(1, "Message is required"),
});

const configSchema = z.object({
  successRate: z.number().min(0).max(1).default(1.0),
  delayMs: z.number().min(0).max(60000).default(0),
  failMessage: z.string().default("Mock gateway error"),
  failStatusCode: z.number().min(400).max(599).default(500),
  sequentialId: z.boolean().default(true),
  idPrefix: z.string().default("mock_"),
});

type ConfigOutput = z.infer<typeof configSchema>;

// In-memory config and state (module-level for shared state)
let config: ConfigOutput = configSchema.parse({});
let sequentialCounter = 0;

const app = new Hono();

// Apply CORS to all responses
app.use("*", async (c: Context, next: () => Promise<void>) => {
  await next();
  Object.entries(corsHeaders).forEach(([key, value]) => {
    c.res.headers.set(key, value);
  });
});

app.options("*", () => new Response("ok", { headers: corsHeaders }));

// GET /health
app.get("/health", (c: Context) => {
  return c.json({
    status: "ok",
    service: "sms-gateway-mock",
    config: { ...config },
  });
});

// POST /config - runtime config update (partial updates supported)
app.post("/config", async (c: Context) => {
  try {
    const body = await c.req.json();
    const validation = configSchema.partial().safeParse(body);

    if (!validation.success) {
      return c.json(
        {
          error: "Invalid config",
          details: validation.error.issues,
        },
        400,
      );
    }

    config = { ...config, ...validation.data };

    logger.info("Config updated", { config });

    return c.json({
      success: true,
      config: { ...config },
    });
  } catch (error) {
    logger.error("Failed to update config", {
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json({ error: "Failed to parse config" }, 400);
  }
});

// POST /send-sms
app.post("/send-sms", async (c: Context) => {
  const timestamp = new Date().toISOString();

  try {
    const body = await c.req.json();
    const validation = sendSmsSchema.safeParse(body);

    if (!validation.success) {
      logger.warn("Invalid SMS request", {
        timestamp,
        error: validation.error.issues,
      });

      return c.json(
        {
          message: "Invalid request: phone and message are required",
          success: false,
        },
        400,
      );
    }

    const { phone, message } = validation.data;
    const messageLength = message.length;

    // Log request with config snapshot
    logger.info("SMS request received", {
      timestamp,
      phone,
      messageLength,
      configSnapshot: { ...config },
    });

    // Apply artificial delay if configured
    if (config.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, config.delayMs));
    }

    // Determine success/failure based on successRate
    const randomValue = Math.random();
    const shouldFail = randomValue > config.successRate;

    if (shouldFail) {
      logger.info("SMS send failed (mock)", {
        timestamp,
        phone,
        messageLength,
        result: "error",
        statusCode: config.failStatusCode,
        randomValue,
      });

      return c.json(
        {
          message: config.failMessage,
          success: false,
        },
        config.failStatusCode as unknown as undefined,
      );
    }

    // Generate message ID
    let messageId: string;
    if (config.sequentialId) {
      sequentialCounter++;
      messageId = `${config.idPrefix}${sequentialCounter}`;
    } else {
      messageId = `${config.idPrefix}${crypto.randomUUID()}`;
    }

    logger.info("SMS send success (mock)", {
      timestamp,
      phone,
      messageLength,
      result: "success",
      messageId,
      randomValue,
    });

    return c.json({
      id: messageId,
      messageId: messageId,
      success: true,
    });
  } catch (error) {
    logger.error("Unexpected error in /send-sms", {
      timestamp,
      error: error instanceof Error ? error.message : String(error),
    });

    return c.json(
      {
        message: "Internal server error",
        success: false,
      },
      500,
    );
  }
});

/**
 * Create and return the Hono app instance for programmatic use.
 * Useful for testing with Supabase's serve() function.
 */
export function createMockServer(): Hono {
  return app;
}

/**
 * Reset the mock server state to defaults.
 * Resets config and sequential counter.
 */
export function resetMockServer(): void {
  config = configSchema.parse({});
  sequentialCounter = 0;
  logger.info("Mock server reset to defaults");
}

// Start server
logger.info(`Starting SMS gateway mock on port ${PORT}`);

export default {
  port: PORT,
  fetch: app.fetch,
};