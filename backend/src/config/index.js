export const LEADMINER_API_PORT = parseInt(process.env.LEADMINER_API_PORT);
export const IMAP_AUTH_TIMEOUT = parseInt(process.env.IMAP_AUTH_TIMEOUT);
export const IMAP_CONNECTION_TIMEOUT = parseInt(
  process.env.IMAP_CONNECTION_TIMEOUT
);
export const IMAP_MAX_CONNECTIONS = parseInt(process.env.IMAP_MAX_CONNECTIONS);
export const REDIS_PORT = parseInt(process.env.REDIS_PORT);
export const REDIS_CONSUMER_BATCH_SIZE = parseInt(
  process.env.REDIS_CONSUMER_BATCH_SIZE
);

export const LEADMINER_MINING_ID_GENERATOR_LENGTH = parseInt(
  process.env.LEADMINER_MINING_ID_GENERATOR_LENGTH
);
export const LEADMINER_FETCH_BATCH_SIZE = parseInt(
  process.env.LEADMINER_FETCH_BATCH_SIZE
);

export const SENTRY_ENABLED =
  String(process.env.SENTRY_ENABLED).toLowerCase() === 'true';
export const REDIS_TLS = String(process.env.REDIS_TLS).toLowerCase() === 'true';
export const IMAP_FETCH_BODY =
  String(process.env.IMAP_FETCH_BODY).toLowerCase() === 'true';

export const ALLOWED_ORIGINS = [
  'http://localhost:8080', // For local development
  process.env.FRONTEND_HOST
];

export const OAUTH_PROVIDERS = [
  {
    name: 'google',
    authorizationURL: `${process.env.GOOGLE_AUTHORIZATION_URL}`,
    tokenURL: `${process.env.GOOGLE_TOKEN_URL}`,
    clientID: `${process.env.GOOGLE_CLIENT_ID}`,
    clientSecret: `${process.env.GOOGLE_SECRET}`,
    issuerURL: `${process.env.GOOGLE_ISSUER_URL}`,
    userInfoURL: `${process.env.GOOGLE_USERINFO_URL}`,
    jwkURI: `${process.env.GOOGLE_JWK_URI}`,
    scopes: ['https://mail.google.com/']
  },
  {
    name: 'azure',
    authorizationURL: `${process.env.AZURE_AUTHORIZATION_URL}`,
    tokenURL: `${process.env.AZURE_TOKEN_URL}`,
    clientID: `${process.env.AZURE_CLIENT_ID}`,
    clientSecret: `${process.env.AZURE_SECRET}`,
    issuerURL: `${process.env.AZURE_ISSUER_URL}`,
    userInfoURL: `${process.env.AZURE_USERINFO_URL}`,
    jwkURI: `${process.env.AZURE_JWK_URI}`,
    scopes: ['https://outlook.office.com/mail.read', 'offline_access']
  }
];

export const IMAP_PROVIDERS = [
  {
    name: 'google',
    host: `${process.env.GOOGLE_IMAP_SERVER}`,
    port: 993,
    domains: ['gmail']
  },
  {
    name: 'azure',
    host: `${process.env.MICROSOFT_IMAP_SERVER}`,
    port: 993,
    domains: ['outlook', 'hotmail']
  }
];

export const {
  AUTH_SERVER_URL,
  AUTH_SERVER_CALLBACK,
  SUPABASE_PROJECT_URL,
  SUPABASE_SECRET_PROJECT_TOKEN,
  PG_CONNECTION_STRING,
  CONNECTION_TYPE,
  LEADMINER_API_HASH_SECRET,
  LEADMINER_API_LOG_LEVEL,
  GRAFANA_LOKI_HOST,
  SENTRY_DSN,
  GOOGLE_CLIENT_ID,
  GOOGLE_SECRET,
  REDIS_HOST,
  REDIS_PASSWORD,
  REDIS_USERNAME
} = process.env;
