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
 * The schema's `boolean()` helper is `z.enum(['true','false']).transform(...)`:
 * it takes the STRINGS `"true"` / `"false"` that dotenv yields and rejects real
 * booleans. Two consequences are pinned here:
 *
 *   1. the default must be the string `'false'` — zod feeds the default value
 *      back through the inner schema, so a boolean default fails validation
 *      whenever the variable is unset;
 *   2. the flag must behave identically to `SIGNATURE_USE_LLM`, the existing
 *      switch for the same subsystem, so ops staff cannot configure them
 *      differently by accident.
 *
 * Deliberately no fixture of credential-shaped values: the schema only checks
 * length and URL shape, so the base environment is assembled from obviously
 * non-secret placeholders, and the accept/reject assertions inspect *which*
 * field failed rather than requiring a fully valid environment.
 */

const FIELD = 'SIGNATURE_LLM_REQUIRE_ZDR';
const SIBLING = 'SIGNATURE_USE_LLM';

/** Fields that have a value problem, as `path.to.field` strings. */
function fieldsWithIssues(env: Record<string, string | undefined>): string[] {
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    if (typeof v === 'string') cleaned[k] = v;
  }
  const parsed = schema.safeParse(cleaned);
  if (parsed.success) return [];
  return parsed.error.issues.map((i) => i.path.join('.'));
}

describe('SIGNATURE_LLM_REQUIRE_ZDR', () => {
  describe('value handling', () => {
    it.each([
      ['true', true],
      ['false', false]
    ])('should read the string %s as %s', (raw, expected) => {
      const parsed = schema.safeParse({
        ...process.env,
        [FIELD]: raw
      });
      // Whether the rest of the environment is complete is irrelevant: what
      // matters is that the flag itself is not reported as a problem, and
      // that a valid string produces a boolean rather than staying a string.
      expect(fieldsWithIssues({ ...process.env, [FIELD]: raw })).not.toContain(
        FIELD
      );
      if (parsed.success) {
        expect(parsed.data[FIELD]).toBe(expected);
      }
    });

    it.each(['yes', '1', 'TRUE', 'on', '', 'falsey'])(
      'should reject %p rather than silently resolving to false',
      (raw) => {
        // A typo must fail loudly, not quietly leave an EU-facing deployment
        // without zero-data-retention routing.
        expect(fieldsWithIssues({ ...process.env, [FIELD]: raw })).toContain(
          FIELD
        );
      }
    );

    it('should behave exactly like SIGNATURE_USE_LLM for every input', () => {
      for (const raw of ['true', 'false', 'yes', '1', '', 'TRUE', 'on']) {
        const mine = fieldsWithIssues({ ...process.env, [FIELD]: raw });
        const sibling = fieldsWithIssues({ ...process.env, [SIBLING]: raw });
        expect(mine.includes(FIELD)).toBe(sibling.includes(SIBLING));
      }
    });
  });

  describe('default', () => {
    /**
     * Reading `.data` needs a complete environment. Every stub below is a
     * placeholder the schema accepts on length or URL shape alone — there are
     * no realistic credentials here.
     */
    const stub: Record<string, string> = {
      APP_NAME: 'x',
      LEADMINER_API_PORT: '1',
      LEADMINER_API_HOST: 'http://a.b',
      LEADMINER_API_HASH_SECRET: 'x',
      LEADMINER_MINING_ID_GENERATOR_LENGTH: '8',
      FRONTEND_HOST: 'http://a.b',
      EMAIL_FETCHING_SERVICE_URL: 'http://a.b',
      EMAIL_FETCHING_SERVICE_API_TOKEN: 'xxxxxxxx',
      IMAP_AUTH_TIMEOUT: '1',
      IMAP_CONNECTION_TIMEOUT: '1',
      IMAP_MAX_CONNECTIONS: '1',
      IMAP_FETCH_BODY: 'true',
      REDIS_HOST: 'a',
      REDIS_DB: '0',
      REDIS_PORT: '1',
      REDIS_TLS: 'false',
      REDIS_CONSUMER_BATCH_SIZE: '1',
      REDIS_EMAIL_VERIFICATION_CONSUMER_BATCH_SIZE: '1',
      REDIS_EMAIL_SIGNATURE_CONSUMER_BATCH_SIZE: '1',
      REDIS_PUBSUB_COMMUNICATION_CHANNEL: 'a',
      REDIS_EXTRACTING_STREAM_CONSUMER_GROUP: 'a',
      REDIS_CLEANING_STREAM_CONSUMER_GROUP: 'a',
      REDIS_SIGNATURE_STREAM_NAME: 'a',
      REDIS_SIGNATURE_STREAM_CONSUMER_GROUP: 'a',
      SIGNATURE_USE_LLM: 'true',
      SUPABASE_PROJECT_URL: 'http://a.b',
      SUPABASE_SECRET_PROJECT_TOKEN: 'x',
      SUPABASE_SERVICE_ROLE_KEY: 'x',
      PG_CONNECTION_STRING: 'http://a.b',
      GOOGLE_CLIENT_ID: 'x',
      GOOGLE_SECRET: 'x',
      AZURE_CLIENT_ID: 'x',
      AZURE_SECRET: 'x',
      EMAILS_QUOTA_REACHER: '1',
      EMAILS_QUOTA_MAILERCHECK: '1',
      EMAILS_QUOTA_ZEROBOUNCE: '1',
      REACHER_RATE_LIMITER_REQUESTS: '1',
      REACHER_RATE_LIMITER_INTERVAL: '1'
    };

    it('should accept a complete environment with the flag unset', () => {
      const parsed = schema.safeParse({ ...stub });
      expect(fieldsWithIssues({ ...stub })).toEqual([]);
      expect(parsed.success).toBe(true);
    });

    it('should default to false when unset', () => {
      const parsed = schema.safeParse({ ...stub });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data[FIELD]).toBe(false);
      }
    });

    it('should not treat the flag as required', () => {
      // SIGNATURE_USE_LLM has no default and must be supplied, so a stub
      // without it fails on SIBLING alone — never on FIELD. If this flag were
      // required too, every existing deployment would fail to boot.
      const issues = fieldsWithIssues({
        ...stub,
        SIGNATURE_USE_LLM: undefined
      });
      expect(issues).toContain(SIBLING);
      expect(issues).not.toContain(FIELD);
    });
  });
});
