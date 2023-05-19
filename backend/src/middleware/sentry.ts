import * as Sentry from '@sentry/node';
import { Router } from 'express';
import { SENTRY_DSN } from '../config';
import logger from '../utils/logger';

export default function initializeSentry(app: Router) {
  Sentry.init({
    dsn: SENTRY_DSN,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app }),
      ...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations()
    ],
    tracesSampleRate: 1.0
  });

  logger.info('Sentry integrated to the server ✔️.');
}
