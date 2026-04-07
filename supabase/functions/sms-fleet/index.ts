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
  provider: z.enum(["smsgate", "simple-sms-gateway", "twilio"]),
  base_url: z.string().url().optional(),
  api_key: z.string().min(1),
  sender_id: z.string().optional(),
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
      provider: validation.data.provider,
      base_url: validation.data.base_url ?? null,
      api_key: validation.data.api_key,
      sender_id: validation.data.sender_id ?? null,
      is_active: validation.data.is_active ?? true,
    };

    const { data, error } = await supabaseAdmin
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

app.delete("/gateways/:id", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const id = c.req.param("id");
    const supabaseAdmin = createSupabaseAdmin();

    const { error } = await supabaseAdmin
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
