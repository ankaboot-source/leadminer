import { z } from "zod";

export const createSchema = z.object({
  provider: z.enum(["google", "azure"]),
  provider_token: z.string().min(1),
  provider_refresh_token: z.string().optional().default(""),
});

export const authorizeSchema = z.object({
  provider: z.enum(["google", "azure"]),
  redirect: z.string().min(1).startsWith("/").refine((v) => !v.startsWith("//")),
});

export const callbackQuerySchema = z.object({
  provider: z.enum(["google", "azure"]),
  code: z.string().min(1),
  state: z.string().min(1),
});
