import z from 'zod';

const number = () => z.coerce.number();

const schema = z.object({
  SMS_GATEWAY_MOCK_SERVICE_PORT: number(),
  SMS_GATEWAY_MOCK_SERVICE_NAME: z.string().min(1),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  SMS_GATEWAY_MOCK_LOG_LEVEL: z
    .enum(['debug', 'info', 'notice', 'warning', 'error'])
    .default('info'),
  SMS_GATEWAY_MOCK_TOKEN: z.string().min(1),
  SMS_GATEWAY_MOCK_MAX_MESSAGES: number().default(10000),
  CORS_ALLOWED_ORIGINS: z.string(),

  /* NGROK */
  NGROK_AUTHTOKEN: z.string().optional(),
  NGROK_DOMAIN: z.string().optional(),

  /* SENTRY */
  SENTRY_DSN_SMS_MOCK: z.string().url().optional(),
  SENTRY_ENVIRONMENT_SMS_MOCK: z.string().min(1).optional(),

  /* LOGGING */
  GRAFANA_LOKI_HOST: z.string().url().optional()
});

export default schema;
