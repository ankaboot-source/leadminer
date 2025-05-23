import z from 'zod';

const number = () => z.coerce.number();
const boolean = () =>
  z.enum(['true', 'false']).transform((arg) => arg === 'true');

const schema = z.object({
  APP_NAME: z.string().min(1),
  LEADMINER_API_PORT: number(),
  LEADMINER_API_HOST: z.string().url(),
  LEADMINER_API_HASH_SECRET: z.string().min(1),
  LEADMINER_MINING_ID_GENERATOR_LENGTH: number(),
  LEADMINER_FETCH_BATCH_SIZE: number(),
  FRONTEND_HOST: z.string().url(),

  /* IMAP */
  IMAP_AUTH_TIMEOUT: number(),
  IMAP_CONNECTION_TIMEOUT: number(),
  IMAP_MAX_CONNECTIONS: number(),
  IMAP_FETCH_BODY: boolean(),

  /* REDIS */
  REDIS_HOST: z.string().min(1),
  REDIS_DB: number(),
  REDIS_PASSWORD: z.string().min(1).optional(),
  REDIS_USERNAME: z.string().min(1).optional(),
  REDIS_PORT: number(),
  REDIS_TLS: boolean(),
  REDIS_CONSUMER_BATCH_SIZE: number(),
  REDIS_EMAIL_VERIFICATION_CONSUMER_BATCH_SIZE: number(),
  REDIS_EMAIL_SIGNATURE_CONSUMER_BATCH_SIZE: number(),
  REDIS_PUBSUB_COMMUNICATION_CHANNEL: z.string().min(1),
  REDIS_EXTRACTING_STREAM_CONSUMER_GROUP: z.string().min(1),
  REDIS_CLEANING_STREAM_CONSUMER_GROUP: z.string().min(1),

  REDIS_SIGNATURE_STREAM_NAME: z.string().min(1),
  REDIS_SIGNATURE_STREAM_CONSUMER_GROUP: z.string().min(1),

  /* SUPABASE + POSTGRES */
  SUPABASE_PROJECT_URL: z.string().url(),
  SUPABASE_SECRET_PROJECT_TOKEN: z.string().min(1),
  PG_CONNECTION_STRING: z.string().url(),

  /* SENTRY */
  SENTRY_DSN_BACKEND: z.string().url().optional(),
  SENTRY_ENVIRONMENT_BACKEND: z.string().min(1).optional(),

  /* LOGGING */
  GRAFANA_LOKI_HOST: z.string().url().optional(),
  LEADMINER_API_LOG_LEVEL: z
    .enum(['debug', 'info', 'notice', 'warning', 'error'])
    .default('info'),

  /* OAUTH */
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_SECRET: z.string().min(1),
  AZURE_CLIENT_ID: z.string().min(1),
  AZURE_SECRET: z.string().min(1),

  /* Email verification */
  EMAILS_QUOTA_REACHER: number(),
  EMAILS_QUOTA_MAILERCHECK: number(),
  EMAILS_QUOTA_ZEROBOUNCE: number(),

  LOAD_BALANCE_ENRICHERS: boolean().default('false'),

  /* REACHER */
  REACHER_HOST: z
    .string()
    .min(1)
    .optional()
    .default('https://api.reacher.email'),
  REACHER_API_KEY: z.string().min(1).optional(),
  REACHER_HEADER_SECRET: z.string().min(1).optional(),
  REACHER_SMTP_FROM: z.string().min(1).optional(),
  REACHER_SMTP_HELLO: z.string().min(1).optional(),
  REACHER_PROXY_PORT: number().optional(),
  REACHER_PROXY_HOST: z.string().min(1).optional(),
  REACHER_PROXY_USERNAME: z.string().min(1).optional(),
  REACHER_PROXY_PASSWORD: z.string().min(1).optional(),
  REACHER_REQUEST_TIMEOUT_MS: number().optional().default(60000),
  REACHER_SMTP_CONNECTION_TIMEOUT_SECONDS: number().optional().default(20),
  REACHER_SMTP_CONNECTION_RETRIES: number().optional().default(2),
  REACHER_HOTMAIL_USE_HEADLESS: z
    .string()
    .min(1)
    .optional()
    .default('http://localhost:4444'),
  REACHER_MICROSOFT365_USE_API: boolean().optional().default('true'),
  REACHER_GMAIL_USE_API: boolean().optional().default('false'),
  REACHER_YAHOO_USE_API: boolean().optional().default('false'),
  REACHER_RATE_LIMITER_REQUESTS: number(),
  REACHER_RATE_LIMITER_INTERVAL: number(),

  /* MAILERCHECK */
  MAILERCHECK_API_KEY: z.string().min(1).optional(),

  /* ZEROUBOUNCE */
  ZEROBOUNCE_API_KEY: z.string().min(1).optional(),

  /* VOILANORBERT */
  VOILANORBERT_URL: z.string().min(1).optional(),
  VOILANORBERT_USERNAME: z.string().min(1).optional(),
  VOILANORBERT_API_KEY: z.string().min(1).optional(),

  /* THEDIG */
  THEDIG_URL: z.string().min(1).optional(),
  THEDIG_API_KEY: z.string().min(1).optional(),

  /* PROXYCURL */
  PROXYCURL_URL: z.string().min(1).optional(),
  PROXYCURL_API_KEY: z.string().min(1).optional(),

  NODE_ENV: z.enum(['development', 'production', 'test']).default('production')
});

export default schema;
