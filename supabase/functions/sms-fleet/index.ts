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
  provider: z.enum(["smsgate", "simple-sms-gateway", "twilio"]),
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

    const supabaseAdmin = createSupabaseAdmin();

    const gateway = {
      user_id: user.id,
      name: validation.data.name,
      provider: validation.data.provider,
      config: validation.data.config,
      daily_limit: validation.data.daily_limit ?? 0,
      monthly_limit: validation.data.monthly_limit ?? 0,
      is_active: validation.data.is_active ?? true,
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
