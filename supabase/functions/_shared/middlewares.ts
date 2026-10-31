import { Context, Next } from "hono";
// Type-only: `authorizeUser` is Express-shaped, but importing express as a
// value would pull Node-only modules into Hono edge functions that only use
// `mixedAuth`/`verifyServiceRole`.
import type { NextFunction, Request, Response } from "npm:express";
import { createSupabaseClient } from "./supabase.ts";

const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

/**
 * User JWT auth middleware for Hono edge functions. Requires a valid
 * Supabase JWT Bearer token and sets `c.set("user", user)` for downstream
 * handlers.
 *
 * Additive alongside `authorizeUser` (Express-style) so existing edge
 * functions keep their current behavior.
 */
export async function mixedAuth(c: Context, next: Next) {
  const authHeader = c.req.header("authorization");

  if (!authHeader) {
    return c.json({ error: "Missing Authorization header" }, 401);
  }

  const supabase = createSupabaseClient(authHeader);
  const { data, error } = await supabase.auth.getUser();

  // Match the backend's `authorizeUser`, which only requires an authenticated
  // user. Requiring an email here would 401 phone-only accounts that the
  // backend accepts.
  if (error || !data?.user?.id) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", data.user);
  return await next();
}

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
