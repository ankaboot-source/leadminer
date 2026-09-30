import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest
} from '@jest/globals';
import { Pool } from 'pg';
import type { Logger } from 'winston';
import PgContacts from '../../../src/db/pg/PgContacts';
import { Status } from '../../../src/services/email-status/EmailStatusVerifier';

/**
 * These tests need a real Postgres server (uuid typing is the regression under
 * test, a mocked pool cannot catch it). Point LEADMINER_TEST_DATABASE_URL at a
 * throwaway server/database (e.g. local Supabase:
 * postgresql://postgres:postgres@localhost:54322/postgres) to enable them; the
 * suite creates and drops its own scratch database and is skipped otherwise.
 */
const ADMIN_DATABASE_URL = process.env.LEADMINER_TEST_DATABASE_URL;
const describeWithPostgres = ADMIN_DATABASE_URL ? describe : describe.skip;

function createMockLogger(): Logger {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  } as unknown as Logger;
}

const TARGET_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_PERSON_ID = '22222222-2222-2222-2222-222222222222';
const ALREADY_VERIFIED_ID = '33333333-3333-3333-3333-333333333333';
const USER_ID = '44444444-4444-4444-4444-444444444444';
const OTHER_USER_ID = '55555555-5555-5555-5555-555555555555';

const DATABASE_NAME = `leadminer_pgcontacts_test_${process.pid}_${Date.now()}`;

describeWithPostgres(
  'PgContacts.updateManyPersonsStatus (real Postgres)',
  () => {
    let pool: Pool;

    beforeAll(async () => {
      const adminPool = new Pool({
        connectionString: ADMIN_DATABASE_URL as string
      });
      await adminPool.query(`CREATE DATABASE "${DATABASE_NAME}"`);
      await adminPool.end();

      const testUrl = new URL(ADMIN_DATABASE_URL as string);
      testUrl.pathname = `/${DATABASE_NAME}`;
      pool = new Pool({ connectionString: testUrl.toString() });

      await pool.query(`
        CREATE SCHEMA private;
        CREATE TABLE private.persons (
          id uuid PRIMARY KEY,
          user_id uuid NOT NULL,
          status text
        );
        INSERT INTO private.persons (id, user_id, status) VALUES
          ('${TARGET_ID}', '${USER_ID}', NULL),
          ('${OTHER_PERSON_ID}', '${OTHER_USER_ID}', NULL),
          ('${ALREADY_VERIFIED_ID}', '${USER_ID}', 'VALID');
      `);
    });

    afterAll(async () => {
      await pool?.end();
      const adminPool = new Pool({
        connectionString: ADMIN_DATABASE_URL as string
      });
      await adminPool.query(
        `DROP DATABASE IF EXISTS "${DATABASE_NAME}" WITH (FORCE)`
      );
      await adminPool.end();
    });

    beforeEach(async () => {
      await pool.query(`
        UPDATE private.persons
        SET status = CASE
          WHEN id = '${ALREADY_VERIFIED_ID}' THEN 'VALID'
          ELSE NULL
        END;
      `);
    });

    it('persists the status of a persons row by uuid (regression: uuid = text)', async () => {
      const contacts = new PgContacts(pool, createMockLogger());

      const result = await contacts.updateManyPersonsStatus(USER_ID, [
        { id: TARGET_ID, status: Status.INVALID }
      ]);

      expect(result).toBe(true);

      const { rows } = await pool.query<{ id: string; status: string }>(
        'SELECT id, status FROM private.persons WHERE id = $1',
        [TARGET_ID]
      );
      expect(rows).toEqual([{ id: TARGET_ID, status: Status.INVALID }]);
    });

    it('updates multiple persons in one call', async () => {
      const contacts = new PgContacts(pool, createMockLogger());

      const result = await contacts.updateManyPersonsStatus(USER_ID, [
        { id: TARGET_ID, status: Status.RISKY },
        { id: ALREADY_VERIFIED_ID, status: Status.UNKNOWN }
      ]);

      expect(result).toBe(true);

      const { rows } = await pool.query<{ id: string; status: string }>(
        'SELECT id, status FROM private.persons WHERE id = $1',
        [TARGET_ID]
      );
      expect(rows).toEqual([{ id: TARGET_ID, status: Status.RISKY }]);
    });

    it('does not update rows owned by another user', async () => {
      const contacts = new PgContacts(pool, createMockLogger());

      const result = await contacts.updateManyPersonsStatus(OTHER_USER_ID, [
        { id: TARGET_ID, status: Status.VALID }
      ]);

      expect(result).toBe(true);

      const { rows } = await pool.query<{ status: string | null }>(
        'SELECT status FROM private.persons WHERE id = $1',
        [TARGET_ID]
      );
      expect(rows).toEqual([{ status: null }]);
    });

    it('keeps the first verification when the status is already set', async () => {
      const contacts = new PgContacts(pool, createMockLogger());

      const result = await contacts.updateManyPersonsStatus(USER_ID, [
        { id: ALREADY_VERIFIED_ID, status: Status.INVALID }
      ]);

      expect(result).toBe(true);

      const { rows } = await pool.query<{ status: string }>(
        'SELECT status FROM private.persons WHERE id = $1',
        [ALREADY_VERIFIED_ID]
      );
      expect(rows).toEqual([{ status: 'VALID' }]);
    });

    it('returns false instead of throwing on invalid uuid input', async () => {
      const contacts = new PgContacts(pool, createMockLogger());

      const result = await contacts.updateManyPersonsStatus(USER_ID, [
        { id: 'not-a-uuid', status: Status.VALID }
      ]);

      expect(result).toBe(false);
    });
  }
);
