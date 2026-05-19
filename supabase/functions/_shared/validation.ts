import { z } from "zod";

export const emailSchema = z.string().email("Invalid email").min(1);
export const uuidSchema = z.string().uuid("Invalid UUID");
export const phoneSchema = z.string().min(7).max(20);
export const providerSchema = z
  .enum(["google", "microsoft", "other"])
  .or(z.string().min(1));
export const nonEmptyString = z.string().min(1, "Required");
export const isoDateString = z.string().datetime().optional();

export const oauthCredentialsBody = z
  .object({
    provider: providerSchema,
    provider_token: nonEmptyString,
    provider_refresh_token: z.string().optional(),
  })
  .strict();

export const languageSchema = z.string().min(2).max(10);

export const paginationQuery = z
  .object({
    limit: z.coerce
      .number()
      .int()
      .positive()
      .max(100)
      .optional()
      .default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
  })
  .strict();

export function validationErrorBody(error: z.ZodError) {
  return {
    error: "Validation failed",
    details: error.errors.map((e) => ({
      path: e.path.join("."),
      message: e.message,
    })),
  };
}

export function validationErrorResponse(
  error: z.ZodError,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify(validationErrorBody(error)),
    {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
