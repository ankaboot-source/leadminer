import { generateErrorMessage } from 'zod-error';
import z from 'zod';

const schema = z.object({
  STRIPE_WEBHOOK_SECRET: z.string().nonempty().optional(),
  STRIPE_API_VERSION: z.string().default('2023-08-16'),
  STRIPE_API_KEY: z.string().nonempty().optional(),
  FRONTEND_HOST: z.string().nonempty().optional()
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
