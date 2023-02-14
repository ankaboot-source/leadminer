const {
  SUPABASE_PROJECT_URL,
  SUPABASE_SECRET_PROJECT_TOKEN,
  PG_CONNECTION_STRING,
  CONNECTION_TYPE,
  LEADMINER_API_HASH_SECRET,
  LEADMINER_API_LOG_LEVEL,
  SENTRY_DSN,
  REDIS_USERNAME,
  REDIS_PASSWORD,
  REDIS_HOST,
  GOOGLE_CLIENT_ID,
  GOOGLE_SECRET
} = process.env;

const LEADMINER_API_PORT = parseInt(process.env.LEADMINER_API_PORT);
const IMAP_AUTH_TIMEOUT = parseInt(process.env.IMAP_AUTH_TIMEOUT);
const IMAP_CONNECTION_TIMEOUT = parseInt(process.env.IMAP_CONNECTION_TIMEOUT);
const REDIS_PORT = parseInt(process.env.REDIS_PORT);
const REDIS_CONSUMER_BATCH_SIZE = parseInt(
  process.env.REDIS_CONSUMER_BATCH_SIZE
);

const SENTRY_ENABLED =
  String(process.env.SENTRY_ENABLED).toLowerCase() === 'true';
const REDIS_TLS = String(process.env.REDIS_TLS).toLowerCase() === 'true';
const IMAP_FETCH_BODY =
  String(process.env.IMAP_FETCH_BODY).toLowerCase() === 'true';

const ALLOWED_ORIGINS = [
  'http://localhost:8080', // For local development
  process.env.FRONTEND_HOST
];

module.exports = {
  SUPABASE_PROJECT_URL,
  SUPABASE_SECRET_PROJECT_TOKEN,
  PG_CONNECTION_STRING,
  CONNECTION_TYPE,
  LEADMINER_API_PORT,
  IMAP_AUTH_TIMEOUT,
  IMAP_CONNECTION_TIMEOUT,
  LEADMINER_API_HASH_SECRET,
  LEADMINER_API_LOG_LEVEL,
  IMAP_FETCH_BODY,
  SENTRY_DSN,
  GOOGLE_CLIENT_ID,
  GOOGLE_SECRET,
  SENTRY_ENABLED,
  REDIS_TLS,
  REDIS_HOST,
  REDIS_PORT,
  REDIS_PASSWORD,
  REDIS_USERNAME,
  REDIS_CONSUMER_BATCH_SIZE,
  ALLOWED_ORIGINS
};
