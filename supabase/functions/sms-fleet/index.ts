import { Context, Hono } from "hono";
import { z } from "zod";
import corsHeaders from "../_shared/cors.ts";
import {
  createSupabaseAdmin,
  createSupabaseClient,
} from "../_shared/supabase.ts";
import { createLogger } from "../_shared/logger.ts";

const logger = createLogger("sms-fleet");

const functionName = "sms-fleet";

const gatewaySchema = z.object({
  name: z.string().min(1),
  provider: z.enum(["smsgate", "simple-sms-gateway", "sms-gateway", "twilio"]),
  config: z.record(z.unknown()),
  daily_limit: z.number().int().min(0).optional(),
  monthly_limit: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  config: z.record(z.unknown()).optional(),
  daily_limit: z.number().int().min(0).optional(),
  monthly_limit: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

type User = {
  id: string;
  email: string;
};

type Variables = {
  user: User;
};

const app = new Hono<{ Variables: Variables }>().basePath(`/${functionName}`);

const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
  "SUPABASE_SERVICE_ROLE_KEY",
) as string;

async function authMiddleware(
  c: Context<{ Variables: Variables }>,
  next: () => Promise<void>,
) {
  const authHeader = c.req.header("authorization");

  if (!authHeader) {
    return c.json({ error: "Missing Authorization header" }, 401);
  }

  if (authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
    await next();
    return;
  }

  const supabase = createSupabaseClient(authHeader);
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user?.id || !data.user.email) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", data.user as User);
  await next();
}

app.use("*", async (c, next) => {
  await next();
  Object.entries(corsHeaders).forEach(([key, value]) => {
    c.res.headers.set(key, value);
  });
});

app.options("*", () => new Response("ok", { headers: corsHeaders }));

app.get("/health", (c) => c.json({ status: "ok", service: functionName }));

app.get("/gateways", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const supabaseAdmin = createSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .schema("private")
      .from("sms_fleet_gateways")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("Failed to fetch gateways", {
        userId: user.id,
        error: error.message,
      });
      return c.json({ error: error.message }, 500);
    }

    return c.json(data);
  } catch (error) {
    logger.error("Unexpected error in GET /gateways", {
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * Extract the base URL the simple-sms-gateway provider needs from the
 * caller-supplied config. The frontend currently uses the
 * `simpleSmsGatewayBaseUrl` key, but the gateway row may also use
 * `baseUrl` for SMSGate and other providers.
 */
function extractSimpleSmsGatewayBaseUrl(
  config: Record<string, unknown>,
): string | null {
  const candidates: unknown[] = [
    config.simpleSmsGatewayBaseUrl,
    config.baseUrl,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return null;
}

/**
 * Lightweight reachability probe shared by POST /gateways (and the
 * mirrored route in `sms-campaigns/index.ts`). POSTs a single test SMS
 * to `<baseUrl>/send-sms` with a throwaway phone number and treats any
 * 2xx, 3xx, or 4xx response as proof the gateway is reachable. 5xx,
 * network errors, and timeouts are real failures.
 *
 * This works for both the Android "Simple SMS Gateway" and iOS "SMS
 * Gateway" apps — both expose `POST /send-sms`. The test phone number
 * is intentionally from a non-routable range so the gateway accepts the
 * call but never actually delivers an SMS to a real subscriber.
 */
async function probeGatewayReachability(
  baseUrl: string,
): Promise<{ success: boolean; message: string }> {
  const url = `${baseUrl.replace(/\/$/, "")}/send-sms`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: "+15555550100",
        to: "+15555550100",
        message: "Reachability test",
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (response.status >= 500) {
      return {
        success: false,
        message: `Gateway returned HTTP ${response.status}`,
      };
    }
    return { success: true, message: "Gateway is reachable" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: message || "Network error reaching gateway",
    };
  }
}

app.post("/gateways", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();

    const validation = gatewaySchema.safeParse(body);
    if (!validation.success) {
      return c.json(
        {
          error: "Invalid gateway data",
          details: validation.error.errors,
        },
        400,
      );
    }

    const validated = validation.data;
    const supabaseAdmin = createSupabaseAdmin();

    // For any self-hosted gateway (Android Simple SMS Gateway or iOS SMS
    // Gateway), do a lightweight reachability probe before persisting.
    // This catches "phone is offline / wrong URL" before the user wastes
    // a campaign on it. The test POSTs a single SMS to `/send-sms` and
    // treats any 2xx, 3xx, or 4xx as proof the gateway is reachable —
    // 5xx / network errors / timeouts are real failures.
    if (
      validated.provider === "simple-sms-gateway" ||
      validated.provider === "sms-gateway"
    ) {
      const baseUrl = extractSimpleSmsGatewayBaseUrl(
        validated.config as Record<string, unknown>,
      );

      if (!baseUrl) {
        return c.json(
          {
            error:
              "Missing simpleSmsGatewayBaseUrl in config for this provider",
            code: "MISSING_BASE_URL",
          },
          400,
        );
      }

      const reachabilityTest = await probeGatewayReachability(baseUrl);
      if (!reachabilityTest.success) {
        logger.warn("SMS gateway reachability test failed", {
          userId: user.id,
          baseUrl,
          provider: validated.provider,
          message: reachabilityTest.message,
        });
        return c.json(
          {
            error: `Gateway is not reachable: ${reachabilityTest.message}`,
            code: "GATEWAY_UNREACHABLE",
          },
          400,
        );
      }
    }

    const gateway = {
      user_id: user.id,
      name: validated.name,
      provider: validated.provider,
      config: validated.config,
      daily_limit: validated.daily_limit ?? 200,
      monthly_limit: validated.monthly_limit ?? 200,
      is_active: validated.is_active ?? true,
    };

    const { data, error } = await supabaseAdmin
      .schema("private")
      .from("sms_fleet_gateways")
      .insert(gateway)
      .select()
      .single();

    if (error) {
      logger.error("Failed to create gateway", {
        userId: user.id,
        error: error.message,
      });
      return c.json({ error: error.message }, 500);
    }

    logger.info("Gateway created", {
      userId: user.id,
      gatewayId: data.id,
      provider: data.provider,
    });

    return c.json(data, 201);
  } catch (error) {
    logger.error("Unexpected error in POST /gateways", {
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json({ error: "Internal server error" }, 500);
  }
});

app.put("/gateways/:id", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const id = c.req.param("id");
    const body = await c.req.json();

    const validation = updateSchema.safeParse(body);
    if (!validation.success) {
      return c.json(
        {
          error: "Invalid gateway data",
          details: validation.error.errors,
        },
        400,
      );
    }

    const supabaseAdmin = createSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .schema("private")
      .from("sms_fleet_gateways")
      .update({
        ...validation.data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      logger.error("Failed to update gateway", {
        userId: user.id,
        gatewayId: id,
        error: error.message,
      });
      return c.json({ error: error.message }, 500);
    }

    if (!data) {
      return c.json({ error: "Gateway not found" }, 404);
    }

    logger.info("Gateway updated", {
      userId: user.id,
      gatewayId: data.id,
    });

    return c.json(data);
  } catch (error) {
    logger.error("Unexpected error in PUT /gateways/:id", {
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json({ error: "Internal server error" }, 500);
  }
});

app.delete("/gateways/:id", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const id = c.req.param("id");
    const supabaseAdmin = createSupabaseAdmin();

    const { error } = await supabaseAdmin
      .schema("private")
      .from("sms_fleet_gateways")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      logger.error("Failed to delete gateway", {
        userId: user.id,
        gatewayId: id,
        error: error.message,
      });
      return c.json({ error: error.message }, 500);
    }

    logger.info("Gateway deleted", {
      userId: user.id,
      gatewayId: id,
    });

    return c.json({ success: true });
  } catch (error) {
    logger.error("Unexpected error in DELETE /gateways/:id", {
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json({ error: "Internal server error" }, 500);
  }
});

app.onError((err, c) => {
  logger.error("Unhandled sms-fleet error", {
    path: c.req.path,
    method: c.req.method,
    error: err.message,
    stack: err.stack,
  });

  return c.json(
    {
      error: "Unexpected server error",
      code: "INTERNAL_ERROR",
      detail: err.message,
    },
    500,
  );
});

export default app;
