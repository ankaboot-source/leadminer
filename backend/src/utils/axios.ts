import axios from 'axios';
import { Logger } from 'winston';
import { errorMeta } from './errors';

// eslint-disable-next-line import/prefer-default-export
export function logError(error: unknown, context: string, logger: Logger) {
  if (axios.isAxiosError(error)) {
    const { stack, code, name, message } = error;
    logger.error(`${context}: ${message}`, { code, name, stack });
  } else {
    logger.error(
      `${context}: ${(error as Error)?.message || 'Something went wrong'}`,
      { error: errorMeta(error) }
    );
  }
}
