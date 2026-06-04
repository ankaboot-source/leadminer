import { describe, expect, it, jest } from '@jest/globals';
import type { Pool } from 'pg';
import type { Logger } from 'winston';
import PgContacts from '../../../src/db/pg/PgContacts';
import type { EmailExtractionResult } from '../../../src/db/types';

function createMockLogger(): Logger {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  } as unknown as Logger;
}

describe('PgContacts create from email', () => {
  it('batches person upserts and marks only new-or-unverified contacts', async () => {
    const KNOWN_ID = '11111111-1111-1111-1111-111111111111';
    const PENDING_ID = '22222222-2222-2222-2222-222222222222';

    const query = jest
      .fn<Pool['query']>()
      .mockResolvedValueOnce({ rowCount: 1, rows: [] } as never)
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: KNOWN_ID, email: 'known@example.com' }]
      } as never)
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: PENDING_ID, email: 'pending@example.com' }]
      } as never)
      .mockResolvedValueOnce({
        rowCount: 2,
        rows: [
          { id: KNOWN_ID, status: 'valid' },
          { id: PENDING_ID, status: null }
        ]
      } as never)
      .mockResolvedValue({ rowCount: 1, rows: [] } as never);

    const pool = { query } as unknown as Pool;
    const contacts = new PgContacts(pool, createMockLogger());

    const extractionResult: EmailExtractionResult = {
      type: 'email',
      message: {
        channel: 'imap',
        folderPath: 'INBOX',
        date: new Date().toISOString(),
        messageId: '<m-1@example.com>',
        references: [],
        listId: undefined,
        conversation: false
      },
      persons: [
        {
          pointOfContact: {
            name: 'Known Person',
            from: true,
            replyTo: false,
            to: true,
            cc: false,
            bcc: false,
            body: true,
            plusAddress: undefined
          },
          person: {
            name: 'Known Person',
            email: 'known@example.com',
            source: 'imap'
          },
          tags: []
        },
        {
          pointOfContact: {
            name: 'Pending Person',
            from: true,
            replyTo: false,
            to: true,
            cc: false,
            bcc: false,
            body: true,
            plusAddress: undefined
          },
          person: {
            name: 'Pending Person',
            email: 'pending@example.com',
            source: 'imap'
          },
          tags: [
            {
              name: 'inbox',
              reachable: 1,
              source: 'extractor'
            }
          ]
        }
      ]
    };

    const result = await contacts.create(
      extractionResult,
      'user-1',
      'mining-1'
    );

    expect(result).toEqual([
      {
        email: 'pending@example.com',
        tags: [
          {
            name: 'inbox',
            reachable: 1,
            source: 'extractor'
          }
        ]
      }
    ]);

    expect(query).toHaveBeenCalledTimes(6);

    const upsertSql = String(query.mock.calls[1][0]);
    expect(upsertSql).toContain('INSERT INTO private.persons');
    expect(upsertSql).toContain('IS DISTINCT FROM');
  });
});
