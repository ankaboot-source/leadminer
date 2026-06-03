import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { Pool, QueryResult } from 'pg';
import { Logger } from 'winston';
import PgSmtpSenders from '../../../src/db/pg/PgSmtpSenders';

describe('PgSmtpSenders', () => {
  const mockQuery = jest.fn<() => Promise<QueryResult>>();
  const mockPool = { query: mockQuery } as unknown as Pool;
  const mockLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
  } as unknown as Logger;
  const encryptionKey = 'test-encryption-key';

  let db: PgSmtpSenders;

  beforeEach(() => {
    jest.clearAllMocks();
    db = new PgSmtpSenders(mockPool, mockLogger, encryptionKey);
  });

  describe('getByUser', () => {
    it('returns senders for user', async () => {
      const mockRows = [
        {
          id: 'uuid-1',
          user_id: 'user-1',
          name: 'Work',
          email: 'user@co.com',
          smtp_host: 'smtp.co.com',
          smtp_port: 587,
          smtp_encryption: 'starttls',
          smtp_user: 'user@co.com',
          auth_type: 'password',
          oauth_provider: null,
          active: true,
          mining_source_id: null,
          created_at: '2026-05-30T00:00:00Z',
          updated_at: '2026-05-30T00:00:00Z'
        }
      ];
      mockQuery.mockResolvedValue({ rows: mockRows });

      const result = await db.getByUser('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('user@co.com');
      expect(result[0].smtpHost).toBe('smtp.co.com');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['user-1']
      );
    });
  });

  describe('create', () => {
    it('inserts sender and returns it', async () => {
      const mockRow = {
        id: 'uuid-1',
        user_id: 'user-1',
        name: 'Work',
        email: 'user@co.com',
        smtp_host: 'smtp.co.com',
        smtp_port: 587,
        smtp_encryption: 'starttls',
        smtp_user: 'user@co.com',
        auth_type: 'password',
        oauth_provider: null,
        active: true,
        mining_source_id: null,
        created_at: '2026-05-30T00:00:00Z',
        updated_at: '2026-05-30T00:00:00Z'
      };
      mockQuery.mockResolvedValue({ rows: [mockRow] });

      const result = await db.create({
        userId: 'user-1',
        name: 'Work',
        email: 'user@co.com',
        smtpHost: 'smtp.co.com',
        smtpPort: 587,
        smtpEncryption: 'starttls',
        smtpUser: 'user@co.com',
        smtpPassword: 'secret'
      });

      expect(result.email).toBe('user@co.com');
      expect(mockQuery).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes sender and returns true', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      const result = await db.delete('uuid-1', 'user-1');

      expect(result).toBe(true);
    });

    it('returns false when sender not found', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0 });

      const result = await db.delete('nonexistent', 'user-1');

      expect(result).toBe(false);
    });
  });
});
