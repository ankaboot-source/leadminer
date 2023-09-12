import { generateErrorMessage } from 'zod-error';
import z from 'zod';

const schema = z.object({
  // stripe conf
  STRIPE_WEBHOOK_SECRET: z.string().nonempty(),
  STRIPE_API_VERSION: z.string().default('2023-08-16'),
  STRIPE_API_KEY: z.string().nonempty(),
  FRONTEND_HOST: z.string().nonempty(),

  // supabase conf
  SUPABASE_PROJECT_URL: z.string().nonempty(),
  SUPABASE_SECRET_PROJECT_TOKEN: z.string().nonempty()
});

const validationResult = schema.safeParse(process.env);
if (!validationResult.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables');
  // eslint-disable-next-line no-console
  console.error(
    generateErrorMessage(validationResult.error.issues, {
      delimiter: { error: '\n' }
    })
  );
  process.exit(-1);
}

const ENV = validationResult.data;

export default ENV;
