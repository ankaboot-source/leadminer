const Sentry = require('@sentry/node');
const Tracing = require('@sentry/tracing');
const config = require('config');
let dsn = config.get('server.sentry.dsn');

module.exports = function SentryMonitoring(app) {
  // init the sentry instance
  Sentry.init({
    dsn: dsn,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Tracing.Integrations.Express({ app })
    ],
    tracesSampleRate: 1.0,
    tracesSampler: (samplingContext) => {
      // sample out transactions from http OPTIONS requests hitting endpoints
      const request = samplingContext.request;
      if (request && request.method == 'OPTIONS') {
        return 0.0;
      } else {
        return 1.0;
      }
    }
  });
  // The Sentry request handler must be the first middleware on the app
  app.use(Sentry.Handlers.requestHandler());
  // TracingHandler creates a trace for every incoming request
  app.use(Sentry.Handlers.tracingHandler());
  return [app, Sentry];
};
