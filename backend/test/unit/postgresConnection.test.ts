import { Client } from 'pg';
import { testPostgresConnection } from '../../src/utils/helpers/postgresConnection';

jest.mock('pg', () => ({
  Client: jest.fn()
}));

describe('postgresConnection', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('testPostgresConnection', () => {
    it('returns success for valid connection', async () => {
      const mockClient = {
        connect: jest.fn().mockResolvedValue(undefined),
        query: jest.fn().mockResolvedValue({ rows: [{ test: 1 }] }),
        end: jest.fn().mockResolvedValue(undefined)
      };

      (Client as unknown as jest.Mock).mockImplementation(() => mockClient);

      const result = await testPostgresConnection({
        host: 'localhost',
        port: 5432,
        database: 'test',
        username: 'user',
        password: 'pass'
      });

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockClient.connect).toHaveBeenCalledTimes(1);
      expect(mockClient.query).toHaveBeenCalledWith('SELECT 1 as test');
      expect(mockClient.end).toHaveBeenCalledTimes(1);
    });

    it('returns error for failed connection', async () => {
      const mockClient = {
        connect: jest.fn().mockRejectedValue(new Error('Connection refused')),
        query: jest.fn(),
        end: jest.fn().mockResolvedValue(undefined)
      };

      (Client as unknown as jest.Mock).mockImplementation(() => mockClient);

      const result = await testPostgresConnection({
        host: 'invalid',
        port: 5432,
        database: 'test',
        username: 'user',
        password: 'pass'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
      expect(mockClient.query).not.toHaveBeenCalled();
      expect(mockClient.end).toHaveBeenCalledTimes(1);
    });
  });
});
