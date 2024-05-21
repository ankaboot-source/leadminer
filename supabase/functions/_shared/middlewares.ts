import { Request, Response, NextFunction } from "express";
import createSupabaseClient from "./supabase-client.ts";

export async function authorizeUser(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const supabaseClient = createSupabaseClient(req.headers["authorization"]);
  const { user } = (await supabaseClient.auth.getUser()).data;

  if (!user) {
    return res.status(403).send("Unauthorized");
  }
  res.locals.user = user;
  return next();
}
