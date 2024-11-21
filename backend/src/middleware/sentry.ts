import * as Sentry from '@sentry/node';
import { Router } from 'express';
import logger from '../utils/logger';

export default function initializeSentry(app: Router, dsn: string) {
  Sentry.init({
    dsn,
    tracesSampleRate: 1.0
  });

  logger.info('Sentry integrated to the server ✔️.');
}
