import { describe, it, expect } from '@jest/globals';
import schema from '../../src/config/schema';

/**
 * `SIGNATURE_LLM_REQUIRE_ZDR` gates `provider: { zdr: true }` on the signature
 * extraction request. A signature block is personal data (name, work email,
 * direct phone, street address), so this has to be settable from the
 * environment — and it must default to OFF, because ZDR endpoints are a minority
 * and are frequently slower and dearer than the default pool. A wrong default
 * would silently change routing for every OSS deployment.
 *
 * The schema's `boolean()` helper is `z.enum(['true','false']).transform(...)`,
 * i.e. it takes the STRINGS `"true"` / `"false"` (what dotenv yields) and
 * rejects real booleans. These tests pin that contract, and pin the new flag to
 * behave identically to `SIGNATURE_USE_LLM`, the existing switch for the same
 * subsystem — if those ever diverge, ops staff would configure them differently
 * without noticing.
 */

/** Every field the schema requires, with a type-valid stub. */
const STUBS: Record<string, string> = {
  APP_NAME: 'test',
  LEADMINER_API_PORT: '3000',
  LEADMINER_API_HOST: 'http://localhost:3000',
  LEADMINER_API_HASH_SECRET: 'secret',
  LEADMINER_MINING_ID_GENERATOR_LENGTH: '8',
  FRONTEND_HOST: 'http://localhost:3000',
  EMAIL_FETCHING_SERVICE_URL: 'http://localhost:8080',
  EMAIL_FETCHING_SERVICE_API_TOKEN: 'token-token-token',
  IMAP_AUTH_TIMEOUT: '10',
  IMAP_CONNECTION_TIMEOUT: '10',
  IMAP_MAX_CONNECTIONS: '10',
  IMAP_FETCH_BODY: 'true',
  REDIS_HOST: 'localhost',
  REDIS_DB: '0',
  REDIS_PORT: '6379',
  REDIS_TLS: 'false',
  REDIS_CONSUMER_BATCH_SIZE: '10',
  REDIS_EMAIL_VERIFICATION_CONSUMER_BATCH_SIZE: '10',
  REDIS_EMAIL_SIGNATURE_CONSUMER_BATCH_SIZE: '10',
  REDIS_PUBSUB_COMMUNICATION_CHANNEL: 'channel',
  REDIS_EXTRACTING_STREAM_CONSUMER_GROUP: 'group',
  REDIS_CLEANING_STREAM_CONSUMER_GROUP: 'group',
  REDIS_SIGNATURE_STREAM_NAME: 'stream',
  REDIS_SIGNATURE_STREAM_CONSUMER_GROUP: 'group',
  SIGNATURE_USE_LLM: 'true',
  SUPABASE_PROJECT_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_PROJECT_TOKEN: 'token',
  SUPABASE_SERVICE_ROLE_KEY: 'key',
  PG_CONNECTION_STRING: 'postgres://user:pass@localhost:5432/db',
  GOOGLE_CLIENT_ID: 'id',
  GOOGLE_SECRET: 'secret',
  AZURE_CLIENT_ID: 'id',
  AZURE_SECRET: 'secret',
  EMAILS_QUOTA_REACHER: '1',
  EMAILS_QUOTA_MAILERCHECK: '1',
  EMAILS_QUOTA_ZEROBOUNCE: '1',
  REACHER_RATE_LIMITER_REQUESTS: '10',
  REACHER_RATE_LIMITER_INTERVAL: '1000'
};

const parse = (overrides: Record<string, string>) => {
  const env: Record<string, string> = { ...STUBS, ...overrides };
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete env[k];
  }
  return schema.safeParse(env);
};

describe('SIGNATURE_LLM_REQUIRE_ZDR', () => {
  it('should accept a full environment with the flag unset', () => {
    const env = { ...STUBS };
    delete (env as Record<string, string | undefined>)
      .SIGNATURE_LLM_REQUIRE_ZDR;
    expect(schema.safeParse(env).success).toBe(true);
  });

  it('should default to false when unset', () => {
    const env = { ...STUBS };
    delete (env as Record<string, string | undefined>)
      .SIGNATURE_LLM_REQUIRE_ZDR;
    const parsed = schema.safeParse(env);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.SIGNATURE_LLM_REQUIRE_ZDR).toBe(false);
    }
  });

  it.each([
    ['true', true],
    ['false', false]
  ])('should read the string %s as %s', (raw, expected) => {
    const parsed = parse({ SIGNATURE_LLM_REQUIRE_ZDR: raw });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.SIGNATURE_LLM_REQUIRE_ZDR).toBe(expected);
    }
  });

  it.each(['yes', '1', 'TRUE', 'on', ''])(
    'should reject %p rather than silently resolving to false',
    (raw) => {
      // A typo must fail loudly, not quietly leave an EU-facing deployment
      // without zero-data-retention routing.
      expect(parse({ SIGNATURE_LLM_REQUIRE_ZDR: raw }).success).toBe(false);
    }
  );

  it('should behave exactly like SIGNATURE_USE_LLM for every input', () => {
    for (const raw of ['true', 'false', 'yes', '1', '', 'TRUE']) {
      const zdr = parse({ SIGNATURE_LLM_REQUIRE_ZDR: raw });
      const llm = parse({ SIGNATURE_USE_LLM: raw });
      expect(zdr.success).toBe(llm.success);
      if (zdr.success && llm.success) {
        expect(zdr.data.SIGNATURE_LLM_REQUIRE_ZDR).toBe(
          llm.data.SIGNATURE_USE_LLM
        );
      }
    }
  });
});
