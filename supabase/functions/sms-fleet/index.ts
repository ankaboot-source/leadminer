import { Context, Hono } from "hono";
import { z } from "zod";
import corsHeaders from "../_shared/cors.ts";
import {
  createSupabaseAdmin,
  createSupabaseClient,
} from "../_shared/supabase.ts";
import { createLogger } from "../_shared/logger.ts";
import {
  type DiscoveredSmsSchema,
  discoverGatewaySpec,
  extractSmsRequestSchema,
  testGatewayReachability,
} from "../sms-campaigns/utils/gateway-spec.ts";

const logger = createLogger("sms-fleet");

const functionName = "sms-fleet";

/**
 * Optional manual overrides for the SMS gateway request shape. The fleet
 * CRUD also accepts these so users can paste in field names discovered
 * outside the auto-discovery flow (e.g. from a custom gateway).
 */
const smsGatewayOverrideSchema = z
  .object({
    endpoint: z.string().optional(),
    phoneField: z.string().optional(),
    messageField: z.string().optional(),
  })
  .partial();

const gatewaySchema = z.object({
  name: z.string().min(1),
  provider: z.enum(["smsgate", "simple-sms-gateway", "twilio"]),
  config: z.record(z.unknown()),
  daily_limit: z.number().int().min(0).optional(),
  monthly_limit: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
  /**
   * Optional manual overrides for the SMS request body shape. When
   * provided, these take precedence over values discovered from the
   * gateway's OpenAPI spec.
   */
  overrides: smsGatewayOverrideSchema.optional(),
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

    // For simple-sms-gateway, auto-discover the request body shape and
    // validate reachability before persisting. This protects users from
    // adding a gateway URL that simply won't accept their SMS payloads.
    let discoveredSchema: DiscoveredSmsSchema | null = null;
    let reachabilityTest: { success: boolean; message: string } | null = null;
    if (validated.provider === "simple-sms-gateway") {
      const baseUrl = extractSimpleSmsGatewayBaseUrl(
        validated.config as Record<string, unknown>,
      );

      if (!baseUrl) {
        return c.json(
          {
            error:
              "Missing simpleSmsGatewayBaseUrl in config for simple-sms-gateway provider",
            code: "MISSING_BASE_URL",
          },
          400,
        );
      }

      const spec = await discoverGatewaySpec(baseUrl);
      if (spec) {
        discoveredSchema = extractSmsRequestSchema(spec);
      }

      // Reachability test uses the discovered schema (or null for legacy
      // shape). The test sends a POST with a test phone number, which most
      // gateways will accept (returning 200) or reject (returning 4xx) —
      // either response proves the gateway is reachable.
      reachabilityTest = await testGatewayReachability(
        baseUrl,
        discoveredSchema,
      );
      if (!reachabilityTest.success) {
        logger.warn("simple-sms-gateway reachability test failed", {
          userId: user.id,
          baseUrl,
          message: reachabilityTest.message,
        });
        // When `?dryRun=true` is set we return the failure as part of the
        // preview payload instead of a 4xx — the caller is asking "what
        // would happen if I saved this?", not "save this for me".
        if (c.req.query("dryRun") === "true") {
          return c.json({
            discoveredSchema,
            reachabilityTest,
          });
        }
        return c.json(
          {
            error: `Gateway is not reachable: ${reachabilityTest.message}`,
            code: "GATEWAY_UNREACHABLE",
          },
          400,
        );
      }
    }

    // Merge discovered schema + manual overrides into the config JSONB.
    const mergedConfig: Record<string, unknown> = {
      ...(validated.config as Record<string, unknown>),
    };
    if (discoveredSchema) {
      mergedConfig.bodySchema = discoveredSchema;
    }
    if (validated.overrides) {
      const { endpoint, phoneField, messageField } = validated.overrides;
      const existing = (mergedConfig.bodySchema ??
        {}) as Partial<DiscoveredSmsSchema>;
      const finalEndpoint = endpoint ?? existing.endpoint;
      const finalPhoneField = phoneField ?? existing.phoneField;
      const finalMessageField = messageField ?? existing.messageField;
      // Overrides only apply when there's already a discovered schema (or
      // when all three overrides are provided). Skip otherwise — the
      // gateway will use the legacy default body shape.
      if (finalEndpoint && finalPhoneField && finalMessageField) {
        mergedConfig.bodySchema = {
          endpoint: finalEndpoint,
          phoneField: finalPhoneField,
          messageField: finalMessageField,
          method: existing.method ?? "POST",
          requiredFields: existing.requiredFields ?? [],
        } satisfies DiscoveredSmsSchema;
      }
    }

    // `?dryRun=true` short-circuits persistence and returns the
    // discovered schema + reachability probe so the frontend can preview
    // the result before the user commits to saving a new gateway. We
    // keep the persisted-config merge above so the preview matches what
    // would actually be stored (overrides included).
    if (c.req.query("dryRun") === "true") {
      return c.json({
        discoveredSchema:
          (mergedConfig.bodySchema as DiscoveredSmsSchema | undefined) ?? null,
        reachabilityTest,
      });
    }

    const gateway = {
      user_id: user.id,
      name: validated.name,
      provider: validated.provider,
      config: mergedConfig,
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
      schemaDiscovered: Boolean(discoveredSchema),
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

/**
 * Re-run spec discovery + reachability for an existing gateway. Useful
 * when the gateway was added before the schema was known, or after the
 * gateway's API surface changed.
 */
app.post("/gateways/:id/redetect", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const id = c.req.param("id");
    const supabaseAdmin = createSupabaseAdmin();

    const { data: existing, error: fetchError } = await supabaseAdmin
      .schema("private")
      .from("sms_fleet_gateways")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !existing) {
      return c.json({ error: "Gateway not found", code: "NOT_FOUND" }, 404);
    }

    if (existing.provider !== "simple-sms-gateway") {
      return c.json(
        {
          error: "Redetect only supported for simple-sms-gateway provider",
          code: "UNSUPPORTED_PROVIDER",
        },
        400,
      );
    }

    const config = (existing.config as Record<string, unknown>) ?? {};
    const baseUrl = extractSimpleSmsGatewayBaseUrl(config);
    if (!baseUrl) {
      return c.json(
        {
          error: "Missing simpleSmsGatewayBaseUrl in gateway config",
          code: "MISSING_BASE_URL",
        },
        400,
      );
    }

    const spec = await discoverGatewaySpec(baseUrl);
    const discoveredSchema = spec ? extractSmsRequestSchema(spec) : null;

    const reachability = await testGatewayReachability(
      baseUrl,
      discoveredSchema,
    );
    if (!reachability.success) {
      return c.json(
        {
          error: `Gateway is not reachable: ${reachability.message}`,
          code: "GATEWAY_UNREACHABLE",
        },
        400,
      );
    }

    const nextConfig: Record<string, unknown> = { ...config };
    if (discoveredSchema) {
      nextConfig.bodySchema = discoveredSchema;
    } else {
      delete nextConfig.bodySchema;
    }

    const { data, error } = await supabaseAdmin
      .schema("private")
      .from("sms_fleet_gateways")
      .update({
        config: nextConfig,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      logger.error("Failed to update gateway after redetect", {
        userId: user.id,
        gatewayId: id,
        error: error.message,
      });
      return c.json({ error: error.message }, 500);
    }

    logger.info("Gateway redetected", {
      userId: user.id,
      gatewayId: id,
      schemaDiscovered: Boolean(discoveredSchema),
    });

    return c.json(data);
  } catch (error) {
    logger.error("Unexpected error in POST /gateways/:id/redetect", {
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
