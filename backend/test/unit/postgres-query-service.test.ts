import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { Client } from 'pg';
import { PostgresQueryService } from '../../src/services/postgresql/PostgresQueryService';

jest.mock('pg', () => ({
  Client: jest.fn()
}));

const MockedClient = Client as unknown as jest.Mock;

describe('PostgresQueryService', () => {
  const credentials = {
    host: 'localhost',
    port: 5432,
    database: 'contacts',
    username: 'readonly',
    password: 'secret',
    ssl: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('previews query with limit and returns rows + columns', async () => {
    const mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue({
        rows: [{ email: 'a@test.com', name: 'Alice' }],
        fields: [{ name: 'email' }, { name: 'name' }],
        rowCount: 1
      }),
      end: jest.fn().mockResolvedValue(undefined)
    };
    MockedClient.mockImplementation(() => mockClient);

    const service = new PostgresQueryService(credentials);
    const result = await service.previewQuery(
      'SELECT email, name FROM contacts'
    );

    expect(result).toEqual({
      columns: ['email', 'name'],
      rows: [{ email: 'a@test.com', name: 'Alice' }],
      totalCount: 1
    });
    expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN READ ONLY');
    expect(mockClient.query).toHaveBeenNthCalledWith(
      2,
      'SELECT * FROM (SELECT email, name FROM contacts) AS leadminer_preview LIMIT 5'
    );
    expect(mockClient.query).toHaveBeenNthCalledWith(3, 'ROLLBACK');
    expect(mockClient.end).toHaveBeenCalledTimes(1);
  });

  it('always caps preview to five rows even when query already has LIMIT', async () => {
    const mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue({
        rows: [{ email: 'a@test.com' }],
        fields: [{ name: 'email' }],
        rowCount: 1
      }),
      end: jest.fn().mockResolvedValue(undefined)
    };
    MockedClient.mockImplementation(() => mockClient);

    const service = new PostgresQueryService(credentials);
    await service.previewQuery('SELECT email FROM contacts LIMIT 100');

    expect(mockClient.query).toHaveBeenCalledWith(
      'SELECT * FROM (SELECT email FROM contacts LIMIT 100) AS leadminer_preview LIMIT 5'
    );
  });

  it('caps preview limit argument to five rows', async () => {
    const mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [], fields: [], rowCount: null })
        .mockResolvedValueOnce({ rows: [], fields: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [], fields: [], rowCount: null }),
      end: jest.fn().mockResolvedValue(undefined)
    };
    MockedClient.mockImplementation(() => mockClient);

    const service = new PostgresQueryService(credentials);
    await service.previewQuery('SELECT email FROM contacts', 100);

    expect(mockClient.query).toHaveBeenNthCalledWith(
      2,
      'SELECT * FROM (SELECT email FROM contacts) AS leadminer_preview LIMIT 5'
    );
  });

  it('defaults ssl to true when credentials omit ssl', async () => {
    const mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [], fields: [], rowCount: null })
        .mockResolvedValueOnce({ rows: [], fields: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [], fields: [], rowCount: null }),
      end: jest.fn().mockResolvedValue(undefined)
    };
    MockedClient.mockImplementation(() => mockClient);

    const service = new PostgresQueryService({
      host: 'localhost',
      port: 5432,
      database: 'contacts',
      username: 'readonly',
      password: 'secret'
    });

    await service.previewQuery('SELECT email FROM contacts');

    expect(MockedClient).toHaveBeenCalledWith(
      expect.objectContaining({
        ssl: { rejectUnauthorized: false }
      })
    );
  });

  it('rejects non-select query', async () => {
    const service = new PostgresQueryService(credentials);

    await expect(service.previewQuery('DELETE FROM contacts')).rejects.toThrow(
      'Only SELECT queries are allowed'
    );
  });

  it('rejects multi-statement query in streaming mode', async () => {
    const service = new PostgresQueryService(credentials);

    await expect(async () => {
      for await (const batch of service.executeQueryStream(
        'SELECT email FROM contacts; SELECT now()'
      )) {
        expect(batch).toBeDefined();
      }
    }).rejects.toThrow('Only a single SELECT statement is allowed');
  });

  it('streams rows in batches until exhausted', async () => {
    const mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [],
          fields: [],
          rowCount: null
        })
        .mockResolvedValueOnce({
          rows: [],
          fields: [],
          rowCount: null
        })
        .mockResolvedValueOnce({
          rows: [{ email: 'a@test.com' }, { email: 'b@test.com' }],
          fields: [{ name: 'email' }],
          rowCount: 2
        })
        .mockResolvedValueOnce({
          rows: [{ email: 'c@test.com' }],
          fields: [{ name: 'email' }],
          rowCount: 1
        })
        .mockResolvedValueOnce({
          rows: [],
          fields: [{ name: 'email' }],
          rowCount: 0
        })
        .mockResolvedValueOnce({
          rows: [],
          fields: [],
          rowCount: null
        })
        .mockResolvedValueOnce({
          rows: [],
          fields: [],
          rowCount: null
        }),
      end: jest.fn().mockResolvedValue(undefined)
    };
    MockedClient.mockImplementation(() => mockClient);

    const service = new PostgresQueryService(credentials);
    const batches: Array<{ rowCount: number }> = [];

    for await (const batch of service.executeQueryStream(
      'SELECT email FROM contacts',
      2
    )) {
      batches.push({ rowCount: batch.rowCount });
    }

    expect(batches).toEqual([{ rowCount: 2 }, { rowCount: 1 }]);
    expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN READ ONLY');
    expect(mockClient.query).toHaveBeenNthCalledWith(
      2,
      'DECLARE leadminer_cursor NO SCROLL CURSOR FOR SELECT email FROM contacts'
    );
    expect(mockClient.query).toHaveBeenNthCalledWith(
      3,
      'FETCH 2 FROM leadminer_cursor'
    );
    expect(mockClient.query).toHaveBeenNthCalledWith(
      4,
      'FETCH 2 FROM leadminer_cursor'
    );
    expect(mockClient.query).toHaveBeenNthCalledWith(
      5,
      'FETCH 2 FROM leadminer_cursor'
    );
    expect(mockClient.query).toHaveBeenNthCalledWith(
      6,
      'CLOSE leadminer_cursor'
    );
    expect(mockClient.query).toHaveBeenNthCalledWith(7, 'COMMIT');
    expect(mockClient.end).toHaveBeenCalledTimes(1);
  });

  it('rolls back and closes client when streaming query fails', async () => {
    const mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [], fields: [], rowCount: null })
        .mockResolvedValueOnce({ rows: [], fields: [], rowCount: null })
        .mockRejectedValueOnce(new Error('fetch failed'))
        .mockResolvedValueOnce({ rows: [], fields: [], rowCount: null }),
      end: jest.fn().mockResolvedValue(undefined)
    };
    MockedClient.mockImplementation(() => mockClient);

    const service = new PostgresQueryService(credentials);

    await expect(async () => {
      for await (const batch of service.executeQueryStream(
        'SELECT email FROM contacts',
        2
      )) {
        expect(batch).toBeDefined();
      }
    }).rejects.toThrow('fetch failed');

    expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN READ ONLY');
    expect(mockClient.query).toHaveBeenNthCalledWith(
      2,
      'DECLARE leadminer_cursor NO SCROLL CURSOR FOR SELECT email FROM contacts'
    );
    expect(mockClient.query).toHaveBeenNthCalledWith(
      3,
      'FETCH 2 FROM leadminer_cursor'
    );
    expect(mockClient.query).toHaveBeenNthCalledWith(4, 'ROLLBACK');
    expect(mockClient.end).toHaveBeenCalledTimes(1);
  });

  it('preserves original stream error when client close fails', async () => {
    const mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [], fields: [], rowCount: null })
        .mockResolvedValueOnce({ rows: [], fields: [], rowCount: null })
        .mockRejectedValueOnce(new Error('fetch failed'))
        .mockResolvedValueOnce({ rows: [], fields: [], rowCount: null }),
      end: jest.fn().mockRejectedValue(new Error('close failed'))
    };
    MockedClient.mockImplementation(() => mockClient);

    const service = new PostgresQueryService(credentials);

    await expect(async () => {
      for await (const batch of service.executeQueryStream(
        'SELECT email FROM contacts',
        2
      )) {
        expect(batch).toBeDefined();
      }
    }).rejects.toThrow('fetch failed');
    expect(mockClient.end).toHaveBeenCalledTimes(1);
  });
});
