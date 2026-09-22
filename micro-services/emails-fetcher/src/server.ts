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

const app = express();

if (ENV.SENTRY_DSN_BACKEND) {
  initializeSentry(app, ENV.SENTRY_DSN_BACKEND, ENV.SENTRY_ENVIRONMENT_BACKEND);
}

app.use(corsMiddleware);

app.use(json({ limit: '5mb' }));
app.use(urlencoded({ limit: '5mb', extended: true }));

app.disable('x-powered-by');

app.get('/', (_, res) =>
  res.json({ message: 'Welcome to leadminer application.' })
);

app.use('/api', apiRoutes);

if (ENV.SENTRY_DSN_BACKEND) {
  Sentry.setupExpressErrorHandler(app);
}

app.use(notFound);
app.use(errorLogger);
app.use(errorHandler);

process.on('uncaughtException', (err) => {
  // uncaught values are not guaranteed to be Errors (throw null, throw 'x'),
  // so guard before reading .message (see PR #2906 review).
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error(`[UNCAUGHT EXCEPTION]: ${message}`, {
    stack
  });
  if (ENV.SENTRY_DSN_BACKEND) {
    Sentry.captureException(err);
  }
});

app.listen(ENV.EMAIL_FETCHING_SERVICE_PORT, () => {
  logger.info(`Server is running on port ${ENV.EMAIL_FETCHING_SERVICE_PORT}.`);
});
