import { Context, Next } from "hono";
import { createSupabaseClient } from "../_shared/supabase.ts";

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("authorization");
  if (!authHeader) {
    return c.json({ error: "Missing authorization header" }, 401);
  }

  const supabase = createSupabaseClient(authHeader);
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user?.id) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", data.user);
  return await next();
}
