import { Handlers, Integrations, init } from '@sentry/node';
import { Integrations as TracingIntegrations } from '@sentry/tracing';
import { SENTRY_DSN, SENTRY_ENABLED } from '../config';
import logger from '../utils/logger';

function initializeSentryIfNeeded(app) {
  if (!SENTRY_ENABLED) {
    return;
  }

  init({
    dsn: SENTRY_DSN,
    integrations: [
      new Integrations.Http({ tracing: true }),
      new TracingIntegrations.Express({ app })
    ],
    tracesSampleRate: 1.0,
    tracesSampler: (samplingContext) => {
      // sample out transactions from http OPTIONS requests hitting endpoints
      const { request } = samplingContext;
      if (request && request.method === 'OPTIONS') {
        return 0.0;
      }

      return 1.0;
    }
  });
  // The Sentry request handler must be the first middleware on the app
  app.use(Handlers.requestHandler());
  // TracingHandler creates a trace for every incoming request
  app.use(Handlers.tracingHandler());

  logger.info('Sentry integrated to the server ✔️.');
}

export default initializeSentryIfNeeded;
