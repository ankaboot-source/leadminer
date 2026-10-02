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

function createMessage() {
  return {
    channel: 'imap',
    folderPath: 'INBOX',
    date: new Date().toISOString(),
    messageId: '<m-phone@example.com>',
    references: [],
    listId: undefined,
    conversation: false
  };
}

function createPointOfContact() {
  return {
    name: 'Phone Person',
    from: true,
    replyTo: false,
    to: true,
    cc: false,
    bcc: false,
    body: true,
    plusAddress: undefined
  };
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
        email: 'known@example.com',
        tags: []
      },
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

    expect(query).toHaveBeenCalledTimes(5);

    const upsertSql = String(query.mock.calls[1][0]);
    expect(upsertSql).toContain('INSERT INTO private.persons');
  });
});

describe('PgContacts phone-only contacts', () => {
  it('create returns phone-only contacts with no email', async () => {
    const PHONE_ID = '33333333-3333-3333-3333-333333333333';

    const query = jest
      .fn<Pool['query']>()
      .mockResolvedValueOnce({ rowCount: 1, rows: [] } as never)
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: PHONE_ID, email: null }]
      } as never)
      .mockResolvedValue({ rowCount: 1, rows: [] } as never);

    const pool = { query } as unknown as Pool;
    const contacts = new PgContacts(pool, createMockLogger());

    const extractionResult: EmailExtractionResult = {
      type: 'email',
      message: createMessage(),
      persons: [
        {
          pointOfContact: createPointOfContact(),
          person: {
            name: 'Phone Person',
            telephone: ['+15551234567'],
            source: 'imap'
          },
          tags: []
        }
      ]
    };

    const result = await contacts.create(
      extractionResult,
      'user-1',
      'mining-1'
    );

    expect(result).toEqual([
      expect.objectContaining({ email: undefined, tags: [] })
    ]);
  });

  it('getContacts returns phone-only rows with id set and email null', async () => {
    const PHONE_ID = '33333333-3333-3333-3333-333333333333';

    const query = jest.fn<Pool['query']>().mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          id: PHONE_ID,
          user_id: 'user-1',
          email: null,
          telephone: ['+15551234567'],
          name: 'Phone Person'
        }
      ]
    } as never);

    const pool = { query } as unknown as Pool;
    const contacts = new PgContacts(pool, createMockLogger());

    const result = await contacts.getContacts('user-1');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({ id: PHONE_ID, email: null })
    );
  });

  it('updateManyPersonsStatus updates phone-only contacts by id (no email required)', async () => {
    const PHONE_ID = '33333333-3333-3333-3333-333333333333';
    const EMAIL_ID = '44444444-4444-4444-4444-444444444444';

    const query = jest
      .fn<Pool['query']>()
      .mockResolvedValue({ rowCount: 2, rows: [] } as never);

    const pool = { query } as unknown as Pool;
    const contacts = new PgContacts(pool, createMockLogger());

    const result = await contacts.updateManyPersonsStatus('user-1', [
      { id: PHONE_ID, status: 'VALID' as never },
      { id: EMAIL_ID, status: 'INVALID' as never }
    ]);

    expect(result).toBe(true);
    expect(query).toHaveBeenCalledTimes(1);

    const sql = String(query.mock.calls[0][0]);
    const params = query.mock.calls[0][1];

    expect(sql).toContain('UPDATE private.persons');
    expect(sql).toContain('unnest($1::uuid[], $2::text[])');
    expect(sql).toContain('p.user_id = $3::uuid');
    expect(sql).not.toContain('%L');
    expect(sql).not.toContain(PHONE_ID);
    expect(sql).not.toContain(EMAIL_ID);
    expect(sql).not.toMatch(/persons\.email\s*=\s*update\.email/);
    expect(params).toEqual([
      [PHONE_ID, EMAIL_ID],
      ['VALID', 'INVALID'],
      'user-1'
    ]);
  });

  it('updateManyPersonsStatus returns false instead of throwing when the query fails', async () => {
    const query = jest
      .fn<Pool['query']>()
      .mockRejectedValue(new Error('operator does not exist: uuid = text'));

    const pool = { query } as unknown as Pool;
    const contacts = new PgContacts(pool, createMockLogger());

    const result = await contacts.updateManyPersonsStatus('user-1', [
      { id: '33333333-3333-3333-3333-333333333333', status: 'VALID' as never }
    ]);

    expect(result).toBe(false);
  });
});

describe('PgContacts activated and not-activated contact lookups', () => {
  function createContacts(query: jest.Mock<Pool['query']>) {
    return new PgContacts({ query } as unknown as Pool, createMockLogger());
  }

  async function runSql(
    call: (contacts: PgContacts) => Promise<unknown>
  ): Promise<string> {
    const query = jest
      .fn<Pool['query']>()
      .mockResolvedValue({ rowCount: 0, rows: [] } as never);

    await call(createContacts(query));

    expect(query).toHaveBeenCalledTimes(1);
    return String(query.mock.calls[0][0]);
  }

  it('treats any engagement row as activated, without filtering on the type', async () => {
    const activated = await runSql((contacts) =>
      contacts.getActivatedContacts('user-1')
    );
    const activatedByIds = await runSql((contacts) =>
      contacts.getActivatedContacts('user-1', ['person-1'])
    );

    for (const sql of [activated, activatedByIds]) {
      expect(sql).toContain('private.engagement');
      expect(sql).toContain('EXISTS');
      expect(sql).toContain('e.person_id = contacts.id');
      expect(sql).toContain('e.user_id = $1');
      expect(sql).not.toContain('engagement_type');
    }
  });

  it('returns one row per contact even with several engagement rows', async () => {
    const sql = await runSql((contacts) =>
      contacts.getActivatedContacts('user-1')
    );

    // EXISTS rather than a join: a person with several engagement rows
    // must not appear more than once.
    expect(sql).not.toMatch(/JOIN\s+private\.engagement/);
  });

  it('passes the ids filter to the by-ids table function', async () => {
    const query = jest
      .fn<Pool['query']>()
      .mockResolvedValue({ rowCount: 0, rows: [] } as never);

    await createContacts(query).getActivatedContacts('user-1', [
      'person-1',
      'person-2'
    ]);

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain('get_contacts_table_by_ids($1,$2)');
    expect(query.mock.calls[0][1]).toEqual([
      'user-1',
      ['person-1', 'person-2']
    ]);
  });

  it('treats a contact with no engagement row at all as not activated', async () => {
    const notActivated = await runSql((contacts) =>
      contacts.getNonExportedContacts('user-1')
    );
    const notActivatedByIds = await runSql((contacts) =>
      contacts.getNonExportedContacts('user-1', ['person-1'])
    );

    for (const sql of [notActivated, notActivatedByIds]) {
      expect(sql).toContain('LEFT JOIN private.engagement');
      expect(sql).toContain('e.person_id = contacts.id');
      expect(sql).toContain('e.user_id = $1');
      expect(sql).toContain('e.person_id IS NULL');
      expect(sql).not.toContain('engagement_type');
    }
  });

  it('leaves the exported lookup on EXPORT rows only', async () => {
    const exported = await runSql((contacts) =>
      contacts.getExportedContacts('user-1')
    );
    const exportedByIds = await runSql((contacts) =>
      contacts.getExportedContacts('user-1', ['person-1'])
    );

    for (const sql of [exported, exportedByIds]) {
      expect(sql).toContain("e.engagement_type = 'EXPORT'");
    }
  });
});
