const config = require('config');

const { port, hash_secret, log_level, imap, allowed_origins } =
  config.get('server');

module.exports = {
  serverPort: port,
  hashSecret: hash_secret,
  logLevel: log_level,
  imapAuthTimeout: imap.authentication_timeout,
  imapConnectionTimeout: imap.connection_timeout,
  allowedOrigins: allowed_origins
};
