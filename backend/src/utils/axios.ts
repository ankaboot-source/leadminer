import axios from 'axios';
import { Logger } from 'winston';

// eslint-disable-next-line import/prefer-default-export
export function logError(error: unknown, context: string, logger: Logger) {
  if (axios.isAxiosError(error)) {
    const { stack, code, name, message } = error;
    logger.error(`${context}: ${message}`, { code, name, stack });
  } else {
    logger.error(`${context}: Something went wrong`, error);
  }
}
