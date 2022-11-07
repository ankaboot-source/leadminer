const config = require('config');

const dsn = process.env.SENTRY_DSN ?? config.get('server.sentry.dsn');
const enabled =
  process.env.SENTRY_ENABLED ?? config.get('server.sentry.enabled');

module.exports = {
  sentryDsn: dsn,
  sentryIsEnabled: enabled
};
