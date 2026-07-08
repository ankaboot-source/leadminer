import { Context, Next } from "hono";
import { createSupabaseClient } from "./supabase.ts";

const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

/**
 * User JWT auth middleware. Requires a valid Supabase JWT Bearer token.
 * Sets `c.set("user", user)` for downstream handlers.
 */
export async function mixedAuth(c: Context, next: Next) {
  const authHeader = c.req.header("authorization");

  if (!authHeader) {
    return c.json({ error: "Missing Authorization header" }, 401);
  }

  const supabase = createSupabaseClient(authHeader);
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user?.id || !data.user.email) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", data.user);
  return await next();
}

/**
 * Middleware to ensure the request originates from a trusted backend service.
 */
export async function verifyServiceRole(c: Context, next: Next) {
  const authHeader = c.req.header("authorization");
  if (!authHeader) {
    return c.json({ error: "Missing authorization header" }, 401);
  }

  const token = authHeader.split(" ")[1];
  if (!token || token !== serviceRoleKey) {
    return c.json({ error: "Forbidden" }, 403);
  }

  return await next();
}
