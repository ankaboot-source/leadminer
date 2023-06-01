import { generateErrorMessage } from 'zod-error';
import schema from './schema';

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
