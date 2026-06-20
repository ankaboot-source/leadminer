import { Context, Hono } from "hono";
import corsHeaders from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";
import {
  createSupabaseAdmin,
  createSupabaseClient,
} from "../_shared/supabase.ts";

const logger = createLogger("delete-user");
const functionName = "delete-user";
const app = new Hono().basePath(`/${functionName}`);

app.onError((err, c) => {
  logger.error("Unhandled delete-user error", {
    error: err.message,
    stack: err.stack,
  });
  return c.json({ error: "Unexpected server error" }, 500);
});

app.use("*", async (c, next) => {
  await next();
  Object.entries(corsHeaders).forEach(([key, value]) => {
    c.res.headers.set(key, value);
  });
});

app.options("*", () => new Response("ok", { headers: corsHeaders }));

async function authMiddleware(c: Context, next: () => Promise<void>) {
  const authHeader = c.req.header("authorization");
  if (!authHeader) {
    return c.json({ error: "Missing Authorization header" }, 401);
  }
  const supabase = createSupabaseClient(authHeader);
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data?.user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("user", data.user);
  c.set("supabase", supabase);
  return await next();
}

app.delete("/", authMiddleware, async (c: Context) => {
  const user = c.get("user");
  const userClient = c.get("supabase");
  const admin = createSupabaseAdmin();

  const { error: rpcError } = await userClient
    .schema("private")
    .rpc("delete_user_data");

  if (rpcError) {
    logger.error("Failed to delete user data", { error: rpcError.message });
    return c.json({ error: "Failed to delete user data" }, 500);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);

  if (deleteError) {
    logger.error("Failed to delete auth user", { error: deleteError.message });
    return c.json({ error: "Failed to delete user" }, 500);
  }

  logger.info("User deleted successfully", { userId: user.id });
  return c.json({ message: "Successfully deleted user" });
});

if (import.meta.main) {
  Deno.serve((req) => app.fetch(req));
}

export { app };
