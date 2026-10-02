import * as Sentry from '@sentry/node';

import ENV from './config';
import logger from './utils/logger';

// Sentry must be initialized before Express is imported so the SDK can
// instrument Express. This module is imported at the very top of server.ts,
// ahead of any module that imports express.
if (ENV.SENTRY_DSN_BACKEND) {
  Sentry.init({
    dsn: ENV.SENTRY_DSN_BACKEND,
    environment: ENV.SENTRY_ENVIRONMENT_BACKEND,
    tracesSampleRate: 1.0
  });

  logger.info('Sentry integrated to the server ✔️.');
}
