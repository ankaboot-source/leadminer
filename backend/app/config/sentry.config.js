const config = require('config');

const { dsn, enabled } = config.get('server.sentry');

module.exports = {
  sentryDsn: dsn,
  sentryIsEnabled: enabled
};
