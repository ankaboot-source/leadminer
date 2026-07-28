import './env';
import * as Sentry from '@sentry/node';
import express, { json, urlencoded } from 'express';

import ENV from './config';
import initializeSentry from './middleware/sentry';
import corsMiddleware from './middleware/cors';
import errorHandler from './middleware/errorHandler';
import errorLogger from './middleware/errorLogger';
import notFound from './middleware/notFound';
import logger from './utils/logger';
import apiRoutes from './api';
import { assertNotProduction } from './utils/errors';

// Production guard — throws and exits before server starts
assertNotProduction();

const app = express();

if (ENV.SENTRY_DSN_SMS_MOCK) {
  initializeSentry(
    app,
    ENV.SENTRY_DSN_SMS_MOCK,
    ENV.SENTRY_ENVIRONMENT_SMS_MOCK
  );
}

app.use(corsMiddleware);

app.use(json({ limit: '5mb' }));
app.use(urlencoded({ limit: '5mb', extended: true }));

app.disable('x-powered-by');

app.get('/', (_req, res) =>
  res.json({
    message:
      'SMS gateway mock service. /health, /config, /messages, /:provider/send-sms'
  })
);

app.use('/', apiRoutes);

if (ENV.SENTRY_DSN_SMS_MOCK) {
  Sentry.setupExpressErrorHandler(app);
}

app.use(notFound);
app.use(errorLogger);
app.use(errorHandler);

process.on('uncaughtException', (err) => {
  logger.error(`[UNCAUGHT EXCEPTION]: ${err.message}`, err.stack || err);
  if (ENV.SENTRY_DSN_SMS_MOCK) {
    Sentry.captureException(err);
  }
});

app.listen(ENV.SMS_GATEWAY_MOCK_SERVICE_PORT, () => {
  logger.info(
    `Server is running on port ${ENV.SMS_GATEWAY_MOCK_SERVICE_PORT}.`
  );
});
