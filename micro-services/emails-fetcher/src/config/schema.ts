import z from 'zod';

const number = () => z.coerce.number();
const boolean = () =>
  z.enum(['true', 'false']).transform((arg) => arg === 'true');

const schema = z.object({
  EMAIL_FETCHING_SERVICE_API_TOKEN: z.string().min(1),
  EMAIL_FETCHING_SERVICE_NAME: z.string().min(1),
  EMAIL_FETCHING_SERVICE_PORT: number(),
  EMAIL_FETCHING_SERVICE_LOG_LEVEL: z
    .enum(['debug', 'info', 'notice', 'warning', 'error'])
    .default('info'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),

  // LEADMINER_API_CONF
  LEADMINER_API_HOST: z.string().url(),
  LEADMINER_API_HASH_SECRET: z.string().min(1),

  /* FETCHING */
  FETCHING_BATCH_SIZE_TO_SEND: number(),
  FETCHING_CHUNK_SIZE_PER_CONNECTION: number(),
  FETCHING_MAX_CONNECTIONS_PER_FOLDER: number(),
  FETCHING_MAX_BODY_TEXT_PLAIN_SIZE: number(),

  /* OAUTH */
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_SECRET: z.string().min(1),
  AZURE_CLIENT_ID: z.string().min(1),
  AZURE_SECRET: z.string().min(1),

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

  /* SUPABASE + POSTGRES */
  SUPABASE_PROJECT_URL: z.string().url(),
  SUPABASE_SECRET_PROJECT_TOKEN: z.string().min(1),
  PG_CONNECTION_STRING: z.string().url(),

  /* SENTRY */
  SENTRY_DSN_BACKEND: z.string().url().optional(),
  SENTRY_ENVIRONMENT_BACKEND: z.string().min(1).optional(),

  /* LOGGING */
  GRAFANA_LOKI_HOST: z.string().url().optional()
});

export default schema;
