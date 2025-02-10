import { useRuntimeConfig } from '#imports';
import * as Sentry from '@sentry/nuxt';

Sentry.init({
  dsn: useRuntimeConfig().public.SENTRY_DSN_FRONTEND,
  environment: useRuntimeConfig().public.SENTRY_ENVIRONMENT_FRONTEND,
  integrations: [
    // eslint-disable-next-line import/namespace
    Sentry.browserTracingIntegration(),
    // eslint-disable-next-line import/namespace
    Sentry.replayIntegration(),
  ],
  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for tracing.
  // We recommend adjusting this value in production
  // Learn more at
  // https://docs.sentry.io/platforms/javascript/configuration/options/#traces-sample-rate
  tracesSampleRate: 1.0,

  // Capture Replay for 10% of all sessions,
  // plus for 100% of sessions with an error
  // Learn more at
  // https://docs.sentry.io/platforms/javascript/session-replay/configuration/#general-integration-configuration
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
