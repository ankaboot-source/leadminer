import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Logger } from 'winston';
import { EmailSignatureHandler } from '../../../src/workers/email-signature/handler';
import { Contact } from '../../../src/db/types';

jest.mock('../../../src/config', () => ({
  LEADMINER_API_HOST: 'leadminer-test.io/api/enrich/webhook',
  LEADMINER_API_LOG_LEVEL: 'error',
  SUPABASE_PROJECT_URL: 'fake',
  SUPABASE_SECRET_PROJECT_TOKEN: 'fake'
}));

jest.mock('../../../src/utils/logger');

// ESM-only dists that ts-jest cannot transform; stub them out
// (unused by upsertContact).
jest.mock('email-reply-parser', () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock('p-queue', () => ({
  __esModule: true,
  default: jest.fn()
}));

function mockLogger() {
  return {
    error: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  } as unknown as Logger;
}

interface MockDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

function mockSupabase(
  persons: { id: string }[] | null,
  lookupError: { message: string } | null = null,
  rpcError: { message: string } | null = null
): MockDb {
  const terminalEq = jest.fn(() =>
    Promise.resolve({ data: persons, error: lookupError })
  );
  const firstEq = jest.fn().mockReturnValue({ eq: terminalEq });
  const select = jest.fn().mockReturnValue({ eq: firstEq });
  const from = jest.fn().mockReturnValue({ select });
  const rpc = jest.fn(() => Promise.resolve({ data: [], error: rpcError }));
  const schema = jest.fn().mockReturnValue({ from, rpc });
  return { schema, from, select, firstEq, terminalEq, rpc };
}

function makeHandler(supabase: MockDb) {
  return new EmailSignatureHandler(
    supabase as never,
    {} as never,
    {} as never,
    jest.fn() as never,
    {} as never,
    mockLogger()
  );
}

async function upsertContact(handler: EmailSignatureHandler, contact: unknown) {
  await (
    handler as unknown as {
      upsertContact: (c: unknown) => Promise<void>;
    }
  ).upsertContact(contact);
}

const contact: Partial<Contact> = {
  email: 'jane@example.com',
  user_id: 'user-1',
  job_title: 'Engineer',
  telephone: ['+123'],
  same_as: ['https://x.example/jane']
};

describe('EmailSignatureHandler.upsertContact', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves person ids and sends one record per id with user_id + id', async () => {
    const db = mockSupabase([{ id: 'p1' }, { id: 'p2' }]);
    const handler = makeHandler(db);

    await upsertContact(handler, contact);

    expect(db.schema).toHaveBeenCalledWith('private');
    expect(db.from).toHaveBeenCalledWith('persons');
    expect(db.firstEq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(db.terminalEq).toHaveBeenCalledWith('email', 'jane@example.com');
    expect(db.rpc).toHaveBeenCalledWith('enrich_contacts', {
      p_contacts_data: [
        expect.objectContaining({ id: 'p1', user_id: 'user-1' }),
        expect.objectContaining({ id: 'p2', user_id: 'user-1' })
      ],
      p_update_empty_fields_only: false
    });

    // every record carries both fields the DB function requires
    const records = db.rpc.mock.calls[0][1].p_contacts_data;
    for (const record of records) {
      expect(record.user_id).toBeTruthy();
      expect(record.id).toBeTruthy();
    }
  });

  it('skips the RPC when no person row exists', async () => {
    const db = mockSupabase([]);
    const handler = makeHandler(db);

    await upsertContact(handler, contact);

    expect(db.rpc).not.toHaveBeenCalled();
  });

  it('throws person lookup errors', async () => {
    const db = mockSupabase(null, { message: 'lookup boom' });
    const handler = makeHandler(db);

    await expect(upsertContact(handler, contact)).rejects.toEqual({
      message: 'lookup boom'
    });
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it('throws enrich_contacts RPC errors', async () => {
    const db = mockSupabase([{ id: 'p1' }], null, {
      message: 'rpc boom'
    });
    const handler = makeHandler(db);

    await expect(upsertContact(handler, contact)).rejects.toEqual({
      message: 'rpc boom'
    });
  });
});
