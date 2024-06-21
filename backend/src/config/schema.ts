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
  REDIS_EMAIL_VERIFICATION_CONSUMER_BATCH_SIZE: number(),
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

  /* Email verification */
  LOAD_BALANCE_VERIFIERS: z.boolean().default(false),

  /* REACHER */
  REACHER_HOST: z
    .string()
    .nonempty()
    .optional()
    .default('https://api.reacher.email'),
  REACHER_API_KEY: z.string().nonempty().optional(),
  REACHER_HEADER_SECRET: z.string().nonempty().optional(),
  REACHER_SMTP_FROM: z.string().nonempty().optional(),
  REACHER_SMTP_HELLO: z.string().nonempty().optional(),
  REACHER_PROXY_PORT: number().optional(),
  REACHER_PROXY_HOST: z.string().nonempty().optional(),
  REACHER_PROXY_USERNAME: z.string().nonempty().optional(),
  REACHER_PROXY_PASSWORD: z.string().nonempty().optional(),
  REACHER_REQUEST_TIMEOUT_MS: number().optional().default(60000),
  REACHER_SMTP_CONNECTION_TIMEOUT_SECONDS: number().optional().default(20),
  REACHER_SMTP_CONNECTION_RETRIES: number().optional().default(2),
  REACHER_HOTMAIL_USE_HEADLESS: z
    .string()
    .nonempty()
    .optional()
    .default('http://localhost:4444'),
  REACHER_MICROSOFT365_USE_API: boolean().optional().default('true'),
  REACHER_GMAIL_USE_API: boolean().optional().default('false'),
  REACHER_YAHOO_USE_API: boolean().optional().default('false'),

  /* MAILERCHECK */
  MAILERCHECK_API_KEY: z.string().nonempty().optional(),

  /* ZEROUBOUNCE */
  ZEROBOUNCE_API_KEY: z.string().nonempty().optional(),

  /* CREDITS */
  ENABLE_CREDIT: boolean().default('false'),
  CONTACT_CREDIT: number().optional().default(1),

  NODE_ENV: z.enum(['development', 'production', 'test']).default('production')
});

export default schema;
