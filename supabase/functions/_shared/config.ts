import { generateErrorMessage } from "zod-error";
import z from "zod";

const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  LEADMINER_ANON_KEY: z.string().min(1),
  LEADMINER_PROJECT_URL: z.string().url(),
  LEADMINER_SECRET_TOKEN: z.string().min(1),
});

const validationResult = schema.safeParse(Deno.env.toObject());
if (!validationResult.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment variables");
  // eslint-disable-next-line no-console
  console.error(
    generateErrorMessage(validationResult.error.issues, {
      delimiter: { error: "\n" },
    }),
  );
  Deno.exit()
}

const ENV = validationResult.data;

export default ENV;
