import { Context, Next } from "hono";
import { NextFunction, Request, Response } from "npm:express";
import { createSupabaseClient } from "./supabase.ts";

const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

export async function authorizeUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const supabaseClient = createSupabaseClient(req.headers["authorization"]);
  const { user } = (await supabaseClient.auth.getUser()).data;

  if (!user) {
    return res.status(403).send("Unauthorized");
  }
  res.locals.user = user;
  return next();
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
