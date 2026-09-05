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
 * PATCH /:id/config body — a partial, namespaced update to the source config.
 * Applied atomically (row-locked deep merge) via private.update_mining_source_config.
 * - `mining.last` accepts an object snapshot (write on completion) or `null`
 *   (clear the watermark, e.g. when the user picks "full scan from scratch").
 */
export const configPatchSchema = z.object({
  flags: MINING_SOURCE_FLAGS_SCHEMA.passthrough().optional(),
  folders: z.array(z.string()).nullable().optional(),
  health: SOURCE_HEALTH_SCHEMA.passthrough().partial().optional(),
  mining: z
    .object({
      last: MINING_COMPLETION_SCHEMA.passthrough().nullable().optional(),
    })
    .passthrough()
    .optional(),
});
export type ConfigPatch = z.infer<typeof configPatchSchema>;

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
