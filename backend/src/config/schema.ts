import z from 'zod';

const number = () => z.coerce.number();
const boolean = () =>
  z.enum(['true', 'false']).transform((arg) => arg === 'true');

const schema = z.object({
  LEADMINER_API_PORT: number(),
  LEADMINER_API_HOST: z.string().url(),
  LEADMINER_API_HASH_SECRET: z.string().nonempty(),
  LEADMINER_MINING_ID_GENERATOR_LENGTH: number(),
  LEADMINER_FETCH_BATCH_SIZE: number(),
  FRONTEND_HOST: z.string().url(),

  /* IMAP */
  IMAP_AUTH_TIMEOUT: number(),
  IMAP_CONNECTION_TIMEOUT: number(),
  IMAP_MAX_CONNECTIONS: number(),
  IMAP_FETCH_BODY: boolean(),

  /* REDIS */
  REDIS_HOST: z.string().nonempty(),
  REDIS_PASSWORD: z.string().nonempty().optional(),
  REDIS_USERNAME: z.string().nonempty().optional(),
  REDIS_PORT: number(),
  REDIS_TLS: boolean(),
  REDIS_CONSUMER_BATCH_SIZE: number(),

  /* SUPABASE + POSTGRES */
  SUPABASE_PROJECT_URL: z.string().url(),
  SUPABASE_SECRET_PROJECT_TOKEN: z.string().nonempty(),
  PG_CONNECTION_STRING: z.string().url(),

  /* SENTRY */
  SENTRY_DSN: z.string().url().optional(),

  /* LOGGING */
  GRAFANA_LOKI_HOST: z.string().url().optional(),
  LEADMINER_API_LOG_LEVEL: z
    .enum(['debug', 'info', 'notice', 'warning', 'error'])
    .default('info'),

  /* OAUTH */
  GOOGLE_CLIENT_ID: z.string().nonempty(),
  GOOGLE_SECRET: z.string().nonempty(),
  AZURE_CLIENT_ID: z.string().nonempty(),
  AZURE_SECRET: z.string().nonempty(),
  AUTH_SERVER_URL: z.string().url(),
  AUTH_SERVER_CALLBACK: z.string().url(),

  NODE_ENV: z.enum(['development', 'production', 'test']).default('development')
});

export default schema;
