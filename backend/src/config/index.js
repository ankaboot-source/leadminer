import ProviderPool from '../services/Provider';

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

const providersConfigs = [
  {
    name: 'google',
    oauthConfig: {
      issuerURL: 'https://accounts.google.com',
      authorizationURL: 'https://accounts.google.com/o/oauth2/v2/auth',
      userInfoURL: 'https://openidconnect.googleapis.com/v1/userinfo',
      jwkURI: 'https://www.googleapis.com/oauth2/v3/certs',
      tokenURL: 'https://oauth2.googleapis.com/token',
      clientID: `${process.env.GOOGLE_CLIENT_ID}`,
      clientSecret: `${process.env.GOOGLE_SECRET}`,
      scopes: ['https://mail.google.com/']
    },
    imapConfig: {
      name: 'google',
      host: 'imap.gmail.com',
      port: 993
    },
    domains: ['gmail', 'googlemail', 'google']
  },
  {
    name: 'azure',
    oauthConfig: {
      issuerURL:
        'https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0',
      authorizationURL:
        'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      userInfoURL: 'https://graph.microsoft.com/oidc/userinfo',
      jwkURI: 'https://login.microsoftonline.com/common/discovery/v2.0/keys',
      tokenURL: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      clientID: `${process.env.AZURE_CLIENT_ID}`,
      clientSecret: `${process.env.AZURE_SECRET}`,
      scopes: [
        'https://outlook.office.com/IMAP.AccessAsUser.All',
        'email',
        'offline_access'
      ]
    },
    imapConfig: {
      name: 'azure',
      host: 'outlook.office365.com',
      port: 993
    },
    domains: ['outlook', 'hotmail', 'live', 'msn']
  }
];

export const PROVIDER_POOL = new ProviderPool(providersConfigs);

export const {
  AUTH_SERVER_URL,
  AUTH_SERVER_CALLBACK,
  SUPABASE_PROJECT_URL,
  SUPABASE_SECRET_PROJECT_TOKEN,
  PG_CONNECTION_STRING,
  CONNECTION_TYPE,
  LEADMINER_API_HOST,
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
