/**
 * Jest setup — runs before each test file's modules are imported.
 *
 * The Phase 2 test suite imports modules from `src/` that transitively load
 * `src/config/index.ts`, which validates `process.env` and calls
 * `process.exit(-1)` on failure. CI / local test environments do not always
 * have a `.env` populated, so we seed the required env vars here.
 *
 * Values match `micro-services/sms-gateway-mock/.env.dev`.
 */

process.env.SMS_GATEWAY_MOCK_SERVICE_PORT ??= '8085';
process.env.SMS_GATEWAY_MOCK_SERVICE_NAME ??= 'sms-gateway-mock-service';
process.env.NODE_ENV ??= 'test';
process.env.SMS_GATEWAY_MOCK_LOG_LEVEL ??= 'info';
process.env.SMS_GATEWAY_MOCK_TOKEN ??= 'test-mock-token';
process.env.SMS_GATEWAY_MOCK_MAX_MESSAGES ??= '10000';
process.env.CORS_ALLOWED_ORIGINS ??= 'http://localhost:3000';
