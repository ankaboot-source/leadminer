import { z } from "zod";
import {
  MINING_SOURCE_FLAGS_SCHEMA,
  SOURCE_HEALTH_SCHEMA,
  MINING_COMPLETION_SCHEMA,
} from "../_shared/mining-source-config.ts";

export const createSchema = z.object({
  provider: z.enum(["google", "azure"]),
  provider_token: z.string().min(1),
  provider_refresh_token: z.string().optional().default(""),
});

/**
 * PATCH /:id/config body — the caller sends **params**, never the persisted
 * config object. The mining-sources service maps/merges them (unknown keys are
 * preserved, `null` clears, per-folder cursors are monotonic).
 */
export const configureSourceSchema = z.object({
  mining_flags: MINING_SOURCE_FLAGS_SCHEMA.optional(),
  folders: z.array(z.string()).nullable().optional(),
  passive_mining: z.boolean().optional(),
  health: SOURCE_HEALTH_SCHEMA.partial().optional(),
  mining: z
    .object({
      last: MINING_COMPLETION_SCHEMA.nullable().optional(),
    })
    .optional(),
});
export type ConfigureSourceInput = z.infer<typeof configureSourceSchema>;

export const authorizeSchema = z.object({
  provider: z.enum(["google", "azure"]),
  redirect: z
    .string()
    .min(1)
    .startsWith("/")
    .refine((v) => !v.startsWith("//")),
});

export const callbackQuerySchema = z.object({
  provider: z.enum(["google", "azure"]),
  code: z.string().min(1),
  state: z.string().min(1),
});
