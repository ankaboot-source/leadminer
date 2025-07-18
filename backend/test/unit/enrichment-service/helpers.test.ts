import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  EnrichmentCache,
  enrichFromCache,
  enrichPersonAsync,
  enrichPersonSync,
  getEnrichmentCache
} from '../../../src/controllers/enrichment.helpers';

import { Contact } from '../../../src/db/types';
import ENV from '../../../src/config';
import EnrichmentService from '../../../src/services/enrichment';
import Enrichments from '../../../src/db/supabase/enrichments';
import logger from '../../../src/utils/logger';
import supabaseClient from '../../../src/utils/supabase';

jest.mock('../../../src/config', () => ({
  LEADMINER_API_HOST: 'leadminer-test.io/api/enrich/webhook',
  LEADMINER_API_LOG_LEVEL: 'error',
  SUPABASE_PROJECT_URL: 'fake',
  SUPABASE_SECRET_PROJECT_TOKEN: 'fake'
}));

jest.mock('../../../src/utils/logger');

jest.mock('@supabase/supabase-js');
jest.mock('../../../src/utils/supabase', () => ({
  from: jest.fn().mockReturnThis(),
  schema: jest.fn().mockReturnThis(),
  select: jest.fn(),
  insert: jest.fn(),
  upsert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  rpc: jest.fn()
}));

jest.mock('../../../src/services/enrichment', () => ({
  enrich: jest.fn(),
  enrichSync: jest.fn(),
  enrichAsync: jest.fn(),
  parseResult: jest.fn()
}));

function mockEngagementsDB() {
  return {
    task: jest.fn(),
    tasks: jest.fn(),
    engagements: jest.fn(),
    client: jest.fn(),
    enrich: jest.fn()
  } as unknown as Enrichments;
}

function mockEnrichmentsDB() {
  return {
    redactedTask: jest.fn(),
    enrich: jest.fn()
  } as unknown as Enrichments;
}

const getCache = jest.fn() as jest.MockedFunction<typeof getEnrichmentCache>;

describe('enrichFromCache', () => {
  const enrichmentsDB = mockEngagementsDB();
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should enrich contacts from cache and return un-enriched contacts', async () => {
    const contacts: Contact[] = [
      { id: '1', user_id: 'leadminer-1', email: 'test1@example.com' },
      { id: '2', user_id: 'leadminer-1', email: 'test2@example.com' },
      { id: '3', user_id: 'leadminer-1', email: 'test3@example.com' }
    ];

    const cached = [
      {
        engine: 'cache',
        data: [
          {
            name: 'leadminer',
            jobTitle: 'data miner',
            email: 'test1@example.com'
          },
          {
            name: 'leadminer',
            jobTitle: 'data miner',
            email: 'test2@example.com'
          }
        ],
        raw_data: [
          {
            name: 'leadminer',
            jobTitle: 'data miner',
            email: 'test1@example.com'
          },
          {
            name: 'leadminer',
            jobTitle: 'data miner',
            email: 'test2@example.com'
          }
        ]
      }
    ];

    getCache.mockResolvedValue(cached);

    const result = await enrichFromCache(getCache, enrichmentsDB, contacts);
    expect(getCache).toHaveBeenCalledWith(contacts, EnrichmentService);
    expect(enrichmentsDB.enrich).toHaveBeenCalledWith(cached);
    expect(logger.debug).toHaveBeenCalledWith('Enriched from cache.', [
      contacts[0].email,
      contacts[1].email
    ]);
    expect(result).toEqual([contacts[2]]);
  });

  it('should return all contacts if no cached data is found', async () => {
    const contacts: Contact[] = [
      { id: '1', user_id: 'leadminer-1', email: 'test1@example.com' },
      { id: '2', user_id: 'leadminer-1', email: 'test2@example.com' }
    ];

    getCache.mockResolvedValue([{} as any]);

    const result = await enrichFromCache(getCache, enrichmentsDB, contacts);

    expect(getCache).toHaveBeenCalledWith(contacts, expect.anything());
    expect(enrichmentsDB.enrich).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();
    expect(result).toEqual(contacts);
  });

  it('should handle contacts with missing email field gracefully', async () => {
    const contacts: Partial<Contact>[] = [
      { id: '1', user_id: 'leadminer-1', email: 'test1@example.com' },
      { id: '2', user_id: 'leadminer-1', email: undefined },
      { id: '3', user_id: 'leadminer-1', email: undefined }
    ];

    const cached = [
      {
        engine: 'cache',
        data: [
          {
            name: 'leadminer',
            jobTitle: 'data miner',
            email: 'test1@example.com'
          }
        ],
        raw_data: [
          {
            name: 'leadminer',
            jobTitle: 'data miner',
            email: 'test1@example.com'
          }
        ]
      }
    ];

    getCache.mockResolvedValue(cached);

    const result = await enrichFromCache(getCache, enrichmentsDB, contacts);

    expect(getCache).toHaveBeenCalledWith(contacts, expect.anything());
    expect(enrichmentsDB.enrich).toHaveBeenCalledWith(cached);
    expect(logger.debug).toHaveBeenCalledWith('Enriched from cache.', [
      contacts[0].email
    ]);
    expect(result).toEqual([]);
  });
});

describe('getEnrichmentCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should retrieve and process enrichment cache successfully', async () => {
    const contacts: Partial<Contact>[] = [
      { email: 'test1@example.com' },
      { email: 'test2@example.com' }
    ];

    const expectedRpcData: EnrichmentCache[] = [
      {
        task_id: '',
        user_id: '',
        created_at: '',
        result: { name: 'leadminer', email: 'test1@example.com' },
        engine: 'testEngine'
      }
    ];
    const expectedParse = [
      {
        engine: 'testing',
        data: [
          {
            name: 'leadminer',
            email: 'test1@example.com',
            engine: 'testEngines'
          }
        ],
        raw_data: []
      }
    ];
    const expectedResult = [
      {
        engine: 'cache',
        data: [
          {
            name: 'leadminer',
            email: 'test1@example.com',
            engine: 'testEngines'
          }
        ],
        raw_data: []
      }
    ];

    (supabaseClient.rpc as jest.Mock).mockReturnValueOnce({
      data: expectedRpcData,
      error: null
    });
    (EnrichmentService.parseResult as jest.Mock).mockReturnValueOnce(
      expectedParse
    );

    const result = await getEnrichmentCache(contacts, EnrichmentService);

    expect(supabaseClient.rpc as jest.Mock).toHaveBeenCalledWith(
      'enriched_most_recent',
      {
        emails: ['test1@example.com', 'test2@example.com']
      }
    );
    expect(EnrichmentService.parseResult).toHaveBeenCalledWith(
      [expectedRpcData[0].result],
      expectedRpcData[0].engine
    );
    expect(result).toEqual(expectedResult);
  });

  it('should return an empty array when no data is retrieved', async () => {
    const contacts: Partial<Contact>[] = [{ email: 'test1@example.com' }];

    (supabaseClient.rpc as jest.Mock).mockReturnValueOnce({
      data: null,
      error: null
    });

    const result = await getEnrichmentCache(contacts, EnrichmentService);

    expect(supabaseClient.rpc as jest.Mock).toHaveBeenCalledWith(
      'enriched_most_recent',
      {
        emails: ['test1@example.com']
      }
    );
    expect(result).toEqual([]);
  });

  it('should throw an error when the RPC call fails', async () => {
    const contacts: Partial<Contact>[] = [{ email: 'test1@example.com' }];

    (supabaseClient.rpc as jest.Mock).mockReturnValueOnce({
      data: null,
      error: { message: 'RPC error' }
    });

    await expect(
      getEnrichmentCache(contacts, EnrichmentService)
    ).rejects.toThrow('RPC error');

    expect(supabaseClient.rpc as jest.Mock).toHaveBeenCalledWith(
      'enriched_most_recent',
      {
        emails: ['test1@example.com']
      }
    );
  });

  it('should filter out invalid results after parsing', async () => {
    const contacts: Partial<Contact>[] = [{ email: 'test1@example.com' }];

    const rpcData = [{ result: { data: [] }, engine: 'testEngine' }];

    (supabaseClient.rpc as jest.Mock).mockReturnValueOnce({
      data: rpcData,
      error: null
    });

    (EnrichmentService.parseResult as jest.Mock).mockReturnValueOnce([]);

    const result = await getEnrichmentCache(contacts, EnrichmentService);

    expect(result).toEqual([]);
  });
});

describe('enrichPersonSync', () => {
  const enrichmentsDB = mockEnrichmentsDB();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should enrich all contacts', async () => {
    const contacts = [
      { email: 'test1@example.com' },
      { email: 'test2@example.com' }
    ];

    const enrichmentResults = [
      { data: [{ email: 'test1@example.com' }] },
      { data: [{ email: 'test2@example.com' }] }
    ];

    (EnrichmentService.enrich as jest.Mock).mockImplementation(
      async function* generator() {
        for (const result of enrichmentResults) {
          yield result;
        }
      }
    );

    const result = await enrichPersonSync(enrichmentsDB, contacts);

    expect(enrichmentsDB.redactedTask).toHaveBeenCalled();
    expect(enrichmentsDB.enrich).toHaveBeenCalledTimes(2);
    expect(result).toEqual([]);
  });

  it('should return not enriched contacts', async () => {
    const contacts = [
      { email: 'test1@example.com' },
      { email: 'test2@example.com' }
    ];

    const enrichmentResults = [{ data: [{ email: 'test1@example.com' }] }];

    (EnrichmentService.enrich as jest.Mock).mockImplementation(
      async function* generator() {
        for (const result of enrichmentResults) {
          yield result;
        }
      }
    );

    const result = await enrichPersonSync(enrichmentsDB, contacts);

    expect(enrichmentsDB.redactedTask).toHaveBeenCalled();
    expect(enrichmentsDB.enrich).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ email: 'test2@example.com' }]);
  });

  it('should handle no enrichments gracefully', async () => {
    const contacts = [
      { email: 'test1@example.com' },
      { email: 'test2@example.com' }
    ];

    (EnrichmentService.enrich as jest.Mock).mockImplementation(
      async function* generator() {
        // No results
      }
    );

    const result = await enrichPersonSync(enrichmentsDB, contacts);

    expect(enrichmentsDB.redactedTask).toHaveBeenCalled();
    expect(enrichmentsDB.enrich).not.toHaveBeenCalled();
    expect(result).toEqual(contacts);
  });
});

describe('enrichPersonAsync', () => {
  const enrichmentsDB = mockEnrichmentsDB();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should enrich contacts asynchronously', async () => {
    const contacts = [{ email: 'test1@example.com' }];

    const task = { id: '1' };
    const webhook = `${ENV.LEADMINER_API_HOST}/api/enrich/webhook/${task.id}`;
    const resultData = { data: [{ email: 'test1@example.com' }] };

    (EnrichmentService.enrichAsync as jest.Mock).mockReturnValue(resultData);
    (enrichmentsDB.redactedTask as jest.Mock).mockReturnValue({ id: '1' });

    await enrichPersonAsync(enrichmentsDB, contacts);

    expect(enrichmentsDB.redactedTask).toHaveBeenCalled();
    expect(EnrichmentService.enrichAsync as jest.Mock).toHaveBeenCalledWith(
      contacts,
      webhook
    );
    expect(enrichmentsDB.enrich).toHaveBeenCalledWith([resultData]);
  });

  it('should handle no result from async enrichment gracefully', async () => {
    const contacts = [{ email: 'test1@example.com' }];

    const task = { id: '1' };
    const webhook = `${ENV.LEADMINER_API_HOST}/api/enrich/webhook/${task.id}`;

    (EnrichmentService.enrichAsync as jest.Mock).mockReturnValue(null);

    await enrichPersonAsync(enrichmentsDB, contacts);

    expect(enrichmentsDB.redactedTask).toHaveBeenCalled();
    expect(EnrichmentService.enrichAsync as jest.Mock).toHaveBeenCalledWith(
      contacts,
      webhook
    );
    expect(enrichmentsDB.enrich).not.toHaveBeenCalled();
  });
});
