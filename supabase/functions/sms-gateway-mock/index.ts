import { Context, Hono } from "hono";
import { z } from "zod";
import { createLogger } from "../_shared/logger.ts";
import corsHeaders from "../_shared/cors.ts";

const logger = createLogger("sms-gateway-mock");

const functionName = "sms-gateway-mock";
const app = new Hono().basePath(`/${functionName}`);

// ============================================================
// Types
// ============================================================

interface StoredMessage {
  id: string;
  provider: string;
  campaignId?: string;
  phone: string;
  body: string;
  bodyLength: number;
  timestamp: string;
  success: boolean;
  providerMessageId?: string;
  httpStatus: number;
  durationMs?: number;
}

interface ProviderOverride {
  successRate?: number;
  failStatusCode?: number;
  failMessage?: string;
  delayMs?: number;
}

interface Config {
  global: {
    successRate: number;
    delayMs: number;
    failMessage: string;
    failStatusCode: number;
    sequentialId: boolean;
    idPrefix: string;
  };
  providers: {
    smsgate?: ProviderOverride;
    "simple-sms-gateway"?: ProviderOverride;
  };
}

// ============================================================
// Schemas
// ============================================================

const providerOverrideSchema = z.object({
  successRate: z.number().min(0).max(1).optional(),
  failStatusCode: z.number().min(400).max(599).optional(),
  failMessage: z.string().optional(),
  delayMs: z.number().min(0).max(60000).optional(),
});

const configSchema = z.object({
  global: z
    .object({
      successRate: z.number().min(0).max(1).default(1.0),
      delayMs: z.number().min(0).max(60000).default(0),
      failMessage: z.string().default("Mock gateway error"),
      failStatusCode: z.number().min(400).max(599).default(500),
      sequentialId: z.boolean().default(true),
      idPrefix: z.string().default("mock_"),
    })
    .default(),
  providers: z
    .object({
      smsgate: providerOverrideSchema.optional(),
      "simple-sms-gateway": providerOverrideSchema.optional(),
    })
    .default(),
});

type ConfigOutput = z.infer<typeof configSchema>;

// ============================================================
// In-memory message store
// ============================================================

const MAX_MESSAGES = 10_000;
const messageStore = new Map<string, StoredMessage>();
const campaignIndex = new Map<string, Set<string>>();
let messageOrder: string[] = []; // Track insertion order for ring buffer

function addMessage(message: StoredMessage): void {
  // Ring buffer: drop oldest when full
  if (messageStore.size >= MAX_MESSAGES) {
    const oldestId = messageOrder.shift();
    if (oldestId) {
      const oldest = messageStore.get(oldestId);
      messageStore.delete(oldestId);
      if (oldest?.campaignId) {
        const idx = campaignIndex.get(oldest.campaignId);
        if (idx) {
          idx.delete(oldestId);
          if (idx.size === 0) {
            campaignIndex.delete(oldest.campaignId);
          }
        }
      }
    }
  }

  messageStore.set(message.id, message);
  messageOrder.push(message.id);

  if (message.campaignId) {
    if (!campaignIndex.has(message.campaignId)) {
      campaignIndex.set(message.campaignId, new Set());
    }
    campaignIndex.get(message.campaignId)!.add(message.id);
  }
}

function clearMessageStore(): void {
  messageStore.clear();
  campaignIndex.clear();
  messageOrder = [];
}

// ============================================================
// State
// ============================================================

let config: ConfigOutput = configSchema.parse({});
let sendSmsCounter = 0;

// ============================================================
// Helpers
// ============================================================

function getEffectiveConfig(provider?: string): {
  successRate: number;
  delayMs: number;
  failMessage: string;
  failStatusCode: number;
  sequentialId: boolean;
  idPrefix: string;
} {
  const global = config.global;
  if (!provider || !config.providers?.[provider]) {
    return global;
  }
  const override = config.providers[provider]!;
  return {
    successRate: override.successRate ?? global.successRate,
    delayMs: override.delayMs ?? global.delayMs,
    failMessage: override.failMessage ?? global.failMessage,
    failStatusCode: override.failStatusCode ?? global.failStatusCode,
    sequentialId: global.sequentialId,
    idPrefix: global.idPrefix,
  };
}

function generateMessageId(cfg: ReturnType<typeof getEffectiveConfig>): string {
  sendSmsCounter++;
  if (cfg.sequentialId) {
    return `${cfg.idPrefix}${sendSmsCounter}`;
  }
  return `${cfg.idPrefix}${crypto.randomUUID()}`;
}

function extractCampaignId(
  provider: string,
  headers: Headers,
  body?: Record<string, unknown>,
): string | undefined {
  // Primary: X-Campaign-Id header
  const headerCampaignId = headers.get("X-Campaign-Id");
  if (headerCampaignId) {
    return headerCampaignId;
  }

  // Fallback for simple-sms-gateway: regex body for UUID
  if (provider === "simple-sms-gateway" && body) {
    const bodyStr = JSON.stringify(body);
    const uuidRegex =
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const match = bodyStr.match(uuidRegex);
    if (match) {
      logger.warn("Campaign ID extracted from message body", {
        provider,
        extractedCampaignId: match[0],
      });
      return match[0];
    }
  }

  return undefined;
}

function parseBasicAuth(header: string | null): { username: string; password: string } | null {
  if (!header || !header.startsWith("Basic ")) {
    return null;
  }
  try {
    const base64 = header.slice(6);
    const decoded = atob(base64);
    const colonIdx = decoded.indexOf(":");
    if (colonIdx === -1) {
      return null;
    }
    return {
      username: decoded.slice(0, colonIdx),
      password: decoded.slice(colonIdx + 1),
    };
  } catch {
    return null;
  }
}

function redactPhone(phone: string): string {
  if (phone.length <= 4) {
    return phone;
  }
  return phone.slice(0, 3) + "*".repeat(6) + phone.slice(-2);
}

function redactBody(body: string): string {
  if (body.length <= 50) {
    return body;
  }
  return body.slice(0, 50) + "...";
}

function redactMessage(msg: StoredMessage, full: boolean): StoredMessage {
  if (full) {
    return msg;
  }
  return {
    ...msg,
    phone: redactPhone(msg.phone),
    body: redactBody(msg.body),
  };
}

// ============================================================
// Production guard
// ============================================================

if (Deno.env.get("ENVIRONMENT") === "production") {
  throw new Error("sms-gateway-mock must not run in production");
}

// ============================================================
// Middleware
// ============================================================

app.use("*", async (c: Context, next: () => Promise<void>) => {
  await next();
  Object.entries(corsHeaders).forEach(([key, value]) => {
    c.res.headers.set(key, value);
  });
});

app.options("*", () => new Response("ok", { headers: corsHeaders }));

// ============================================================
// Routes
// ============================================================

// GET /health
app.get("/health", (c: Context) => {
  return c.json({
    status: "ok",
    service: "sms-gateway-mock",
    config: { ...config },
    stats: {
      totalMessages: messageStore.size,
      campaignsTracked: campaignIndex.size,
    },
  });
});

// POST /config
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

    // Deep merge providers
    if (validation.data.providers) {
      config.providers = {
        ...config.providers,
        ...validation.data.providers,
      };
      delete validation.data.providers;
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

// GET /messages
app.get("/messages", async (c: Context) => {
  const campaignId = c.req.query("campaignId");
  const provider = c.req.query("provider");
  const phone = c.req.query("phone");
  const limit = Math.min(parseInt(c.req.query("limit") || "100", 10), 1000);
  const offset = parseInt(c.req.query("offset") || "0", 10);
  const full = c.req.query("full") === "true";
  const mockToken = Deno.env.get("X-Mock-Token");

  // Check full access
  if (full) {
    const token = c.req.header("X-Mock-Token");
    if (!token || token !== mockToken) {
      return c.json({ error: "Invalid or missing X-Mock-Token for full data" }, 401);
    }
  }

  // Build filtered list
  let messages = Array.from(messageStore.values());

  if (campaignId) {
    const ids = campaignIndex.get(campaignId);
    if (ids) {
      messages = messages.filter((m) => ids.has(m.id));
    } else {
      messages = [];
    }
  }

  if (provider) {
    messages = messages.filter((m) => m.provider === provider);
  }

  if (phone) {
    messages = messages.filter((m) => m.phone === phone);
  }

  const total = messages.length;

  // Sort by timestamp descending
  messages.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  // Apply pagination
  messages = messages.slice(offset, offset + limit);

  // Redact PII unless full access
  const redacted = messages.map((m) => redactMessage(m, full));

  return c.json({
    messages: redacted,
    total,
    limit,
    offset,
  });
});

// DELETE /messages
app.delete("/messages", (c: Context) => {
  clearMessageStore();
  logger.info("All messages cleared");
  return c.json({ success: true, message: "All messages cleared" });
});

// POST /:provider/send-sms
app.post("/:provider/send-sms", async (c: Context) => {
  const timestamp = new Date().toISOString();
  const startTime = Date.now();
  const provider = c.req.param("provider");

  // Validate provider
  if (provider !== "simple-sms-gateway" && provider !== "smsgate") {
    return c.json(
      {
        message: `Unknown provider: ${provider}`,
        success: false,
      },
      404,
    );
  }

  // smsgate requires Basic Auth
  if (provider === "smsgate") {
    const authHeader = c.req.header("Authorization");
    const credentials = parseBasicAuth(authHeader);
    if (!credentials) {
      logger.warn("Missing or invalid Basic Auth for smsgate", { timestamp });
      return c.json(
        {
          message: "Missing or invalid Authorization header",
          success: false,
        },
        401,
      );
    }
    // Log auth attempt (not validating credentials for mock)
    logger.debug("smsgate auth attempt", {
      timestamp,
      username: credentials.username,
    });
  }

  try {
    const body = await c.req.json();
    const campaignId = extractCampaignId(provider, c.req.headers, body);

    let phone: string;
    let message: string;

    if (provider === "simple-sms-gateway") {
      const schema = z.object({
        phone: z.string().min(1, "Phone number is required"),
        message: z.string().min(1, "Message is required"),
      });
      const validation = schema.safeParse(body);
      if (!validation.success) {
        logger.warn("Invalid SMS request (simple-sms-gateway)", {
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
      phone = validation.data.phone;
      message = validation.data.message;
    } else {
      // smsgate
      const schema = z.object({
        textMessage: z.object({
          text: z.string().min(1, "Text message is required"),
        }),
        phoneNumbers: z.array(z.string().min(1)).min(1, "At least one phone number is required"),
      });
      const validation = schema.safeParse(body);
      if (!validation.success) {
        logger.warn("Invalid SMS request (smsgate)", {
          timestamp,
          error: validation.error.issues,
        });
        return c.json(
          {
            message: "Invalid request: textMessage.text and phoneNumbers are required",
            success: false,
          },
          400,
        );
      }
      phone = validation.data.phoneNumbers[0];
      message = validation.data.textMessage.text;
    }

    const messageLength = message.length;
    const cfg = getEffectiveConfig(provider);

    logger.info("SMS request received", {
      timestamp,
      provider,
      phone,
      messageLength,
      campaignId,
      configSnapshot: { ...cfg },
    });

    // Apply artificial delay
    if (cfg.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, cfg.delayMs));
    }

    // Determine success/failure
    const randomValue = Math.random();
    const shouldFail = randomValue > cfg.successRate;
    const durationMs = Date.now() - startTime;

    if (shouldFail) {
      const storedMessage: StoredMessage = {
        id: crypto.randomUUID(),
        provider,
        campaignId,
        phone,
        body: message,
        bodyLength: messageLength,
        timestamp,
        success: false,
        httpStatus: cfg.failStatusCode,
        durationMs,
      };
      addMessage(storedMessage);

      logger.info("SMS send failed (mock)", {
        timestamp,
        provider,
        phone,
        messageLength,
        campaignId,
        result: "error",
        statusCode: cfg.failStatusCode,
        randomValue,
        durationMs,
      });

      return c.json(
        {
          message: cfg.failMessage,
          success: false,
        },
        cfg.failStatusCode as unknown as undefined,
      );
    }

    // Success
    const messageId = generateMessageId(cfg);

    const storedMessage: StoredMessage = {
      id: messageId,
      provider,
      campaignId,
      phone,
      body: message,
      bodyLength: messageLength,
      timestamp,
      success: true,
      providerMessageId: messageId,
      httpStatus: 200,
      durationMs,
    };
    addMessage(storedMessage);

    logger.info("SMS send success (mock)", {
      timestamp,
      provider,
      phone,
      messageLength,
      campaignId,
      result: "success",
      messageId,
      randomValue,
      durationMs,
    });

    return c.json({
      id: messageId,
      messageId: messageId,
      success: true,
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error("Unexpected error in /:provider/send-sms", {
      timestamp,
      provider,
      error: error instanceof Error ? error.message : String(error),
      durationMs,
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

// ============================================================
// Exports
// ============================================================

/**
 * Create and return the Hono app instance for programmatic use.
 * Useful for testing with Supabase's serve() function.
 */
export function createMockServer(): Hono {
  return app;
}

/**
 * Reset the mock server state to defaults.
 * Resets config, sequential counter, and message store.
 */
export function resetMockServer(): void {
  config = configSchema.parse({});
  sendSmsCounter = 0;
  clearMessageStore();
  logger.info("Mock server reset to defaults");
}

// Start server
logger.info(`Starting SMS gateway mock at basePath /${functionName}`);

export default {
  fetch: app.fetch,
};