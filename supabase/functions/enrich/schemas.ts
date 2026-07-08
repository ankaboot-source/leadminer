import { z } from "zod";

export const personBodySchema = z.object({
  email: z.string().email("Invalid email"),
  name: z.string().optional(),
  id: z.string().uuid("Invalid contact ID").optional(),
});

export const bulkPersonBodySchema = z.object({
  contacts: z
    .array(
      z.object({
        email: z.string().email(),
        name: z.string().optional(),
        id: z.string().uuid().optional(),
      }),
    )
    .optional(),
  enrichAllContacts: z.boolean().optional(),
  updateEmptyFieldsOnly: z.boolean().optional(),
});

export const webhookBodySchema = z.object({
  token: z.string().min(1, "Token is required"),
  results: z.array(z.unknown()).optional(),
});

export const webhookParamsSchema = z.object({
  id: z.string().uuid("Invalid task ID"),
});