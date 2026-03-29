import { describe, expect, it, jest } from '@jest/globals';
import type { Pool } from 'pg';
import type { Logger } from 'winston';
import PgMiningSources, {
  isPostgreSQLMiningSourceCredentials
} from '../../../src/db/pg/PgMiningSources';

function createMockLogger(): Logger {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  } as unknown as Logger;
}

describe('PgMiningSources', () => {
  it('detects valid PostgreSQL credentials', () => {
    expect(
      isPostgreSQLMiningSourceCredentials({
        host: 'localhost',
        port: 5432,
        database: 'leadminer',
        username: 'readonly',
        password: 'secret',
        ssl: true
      })
    ).toBe(true);
  });

  it('rejects invalid PostgreSQL credentials', () => {
    expect(
      isPostgreSQLMiningSourceCredentials({
        host: 'localhost',
        port: '5432',
        database: 'leadminer',
        username: 'readonly',
        password: 'secret'
      })
    ).toBe(false);
  });

  it('throws when postgres source credentials are invalid', async () => {
    const query = jest.fn<Pool['query']>();
    const pool = { query } as unknown as Pool;
    const repo = new PgMiningSources(pool, createMockLogger(), 'hash-key');

    await expect(
      repo.upsert({
        userId: 'user-1',
        email: 'external-db',
        type: 'postgresql',
        credentials: {
          host: 'localhost',
          port: 5432,
          database: 'leadminer',
          username: 'readonly'
        } as never
      })
    ).rejects.toThrow('Invalid PostgreSQL source credentials');

    expect(query).not.toHaveBeenCalled();
  });

  it('upserts postgres source when credentials are valid', async () => {
    const query = jest.fn<Pool['query']>().mockResolvedValue({} as never);
    const pool = { query } as unknown as Pool;
    const repo = new PgMiningSources(pool, createMockLogger(), 'hash-key');

    await repo.upsert({
      userId: 'user-1',
      email: 'external-db',
      type: 'postgresql',
      credentials: {
        host: 'localhost',
        port: 5432,
        database: 'leadminer',
        username: 'readonly',
        password: 'secret',
        ssl: false
      }
    });

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1]).toEqual([
      'user-1',
      'external-db',
      'postgresql',
      JSON.stringify({
        host: 'localhost',
        port: 5432,
        database: 'leadminer',
        username: 'readonly',
        password: 'secret',
        ssl: false
      }),
      'hash-key'
    ]);
  });
});
