const config = require('config');

const serverPort = process.env.LEADMINER_API_PORT ?? config.get('server.port');
const hashSecret =
  process.env.LEADMINER_API_HASH_SECRET ?? config.get('server.hash_secret');
const logLevel =
  process.env.LEADMINER_API_LOG_LEVEL ?? config.get('server.log_level');
const imapAuthTimeout =
  process.env.IMAP_AUTH_TIMEOUT ??
  config.get('server.imap.authentication_timeout');
const imapConnectionTimeout =
  process.env.IMAP_CONNECTION_TIMEOUT ??
  config.get('server.imap.connection_timeout');

const allowedOrigins = [
  'http://localhost:8080', // For local development
  process.env.FRONTEND_HOST ?? config.get('server.allowed_origins')
];

module.exports = {
  serverPort,
  hashSecret,
  logLevel,
  imapAuthTimeout,
  imapConnectionTimeout,
  allowedOrigins
};
