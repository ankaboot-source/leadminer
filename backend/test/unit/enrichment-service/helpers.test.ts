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

    getCache.mockResolvedValue([{} as never]);

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

// // Test data factories with proper typing
// const createMockContact = (email: string, name?: string): Partial<Contact> => ({
//   email,
//   ...(name && { name })
// });

// const createMockTask = (overrides = {}): TaskEnrich => ({
//   id: 'task-123',
//   user_id: 'user-123',
//   status: 'running',
//   category: 'enriching',
//   type: 'enrich',
//   started_at: null,
//   stopped_at: null,
//   details: {
//     total_enriched: 0,
//     total_to_enrich: 2,
//     update_empty_fields_only: true,
//     result: []
//   },
//   ...overrides
// });

// describe('Enrichment Functions', () => {
//   // skipcq: JS-0323 usage of the any
//   let mockEnricher: any;
//   let mockTask: TaskEnrich;
//   let mockUserResolver: Users;

//   beforeEach(() => {
//     jest.clearAllMocks();

//     mockUserResolver = {} as Users;
//     mockTask = createMockTask();
//     mockEnricher = createMockEnricher(
//       'thedig',
//       (contact) => Boolean(contact.email) && Boolean(contact.name)
//     );
//   });

//   describe('enrichSync: Single enrichment request', () => {
//     it('should successfully enrich contacts', async () => {
//       const contactsToEnrich = [
//         createMockContact('test1@example.com', 'Test User 1'),
//         createMockContact('test2@example.com', 'Test User 2')
//       ];

//       const [results, notEnriched] = await enrichSync({
//         userResolver: mockUserResolver,
//         enricher: mockEnricher,
//         contacts: contactsToEnrich
//       });
//       expect(results).toHaveLength(2);
//       results.forEach((r) => expect(r.instance).toEqual(mockEnricher.type));
//       expect(notEnriched).toHaveLength(0);
//       expect(mockEnricher.rule).toHaveBeenCalledTimes(2);
//     });

//     it('should return non-enriched contacts', async () => {
//       const contactsToEnrich = [
//         createMockContact('test1@example.com'), // not enriched due to rule
//         createMockContact('test2@example.com', 'Test User 2') // enriched,
//       ];
//       const [results, notEnriched] = await enrichSync({
//         userResolver: mockUserResolver,
//         enricher: mockEnricher,
//         contacts: contactsToEnrich
//       });

//       expect(results).toHaveLength(1);
//       expect(notEnriched).toHaveLength(1);
//       expect(notEnriched[0]).toEqual(contactsToEnrich[0]);
//       expect(mockEnricher.rule).toHaveBeenCalledTimes(2);
//     });

//     it('should return contacts as non-enriched on error', async () => {
//       const contactsToEnrich = [
//         createMockContact('test1@example.com'), // not enriched
//         createMockContact('test2@example.com', 'Test User 2') // not enriched,
//       ];
//       const errorMessage = 'API Error';
//       mockEnricher.instance.enrichSync.mockRejectedValue(
//         new Error(errorMessage)
//       );

//       const [results, notEnriched] = await enrichSync({
//         userResolver: mockUserResolver,
//         enricher: mockEnricher,
//         contacts: contactsToEnrich
//       });

//       expect(results).toHaveLength(1);
//       expect(results[0]).toEqual(
//         expect.objectContaining({
//           error: errorMessage,
//           instance: mockEnricher.type
//         })
//       );
//       expect(notEnriched).toEqual(contactsToEnrich);
//     });

//     it('should handle empty contact list', async () => {
//       const [results, notEnriched] = await enrichSync({
//         userResolver: mockUserResolver,
//         enricher: mockEnricher,
//         contacts: []
//       });

//       expect(results).toHaveLength(0);
//       expect(notEnriched).toHaveLength(0);
//       expect(mockEnricher.rule).not.toHaveBeenCalled();
//     });
//   });

//   describe('enrichPersonSync', () => {
//     it('should process contacts through multiple enrichers', async () => {
//       const mockContacts = [
//         createMockContact('test1@example.com'), // enriched by proxyCurl
//         createMockContact('test2@example.com', 'Test User 2') // enriched by Thedig
//       ];

//       const [results, notEnriched] = await enrichPersonSync(
//         mockUserResolver,
//         mockTask,
//         mockContacts
//       );

//       expect(results).toHaveLength(2);
//       results.forEach((r) =>
//         expect(['thedig', 'proxycurl']).toContain(r.instance)
//       );
//       expect(notEnriched).toHaveLength(0);
//     });

//     it('should throw error when no enrichers are available', async () => {
//       const mockContacts = [
//         createMockContact('test1@example.com'),
//         createMockContact('test2@example.com', 'Test User 2')
//       ];
//       (emailEnrichmentService.getEnricher as jest.Mock).mockReturnValue(null);

//       await expect(
//         enrichPersonSync(mockUserResolver, mockTask, mockContacts)
//       ).rejects.toThrow('No enrichers are available to use');
//     });
//   });

//   describe('enrichWebhook', () => {
//     const token = 'webhook-token';
//     const createEnrichedTask = () =>
//       createMockTask({
//         details: {
//           ...mockTask.details,
//           result: [{ token, instance: 'thedig' }]
//         }
//       });

//     beforeEach(() => {
//       (emailEnrichmentService.getEnricher as jest.Mock).mockReturnValue(
//         mockEnricher
//       );
//     });

//     it('should process webhook enrichment results successfully', async () => {
//       const mockResults = [
//         {
//           email: 'test1@example.com',
//           company: 'Test Corp'
//         }
//       ];

//       const mockMappedResult = {
//         data: [{ email: 'test1@example.com', organization: 'Test Corp' }],
//         raw_data: mockResults
//       };

//       mockEnricher.instance.parseResult.mockReturnValue(mockMappedResult);

//       const result = await enrichWebhook(
//         mockUserResolver,
//         createEnrichedTask(),
//         token,
//         mockResults
//       );

//       expect(result).toEqual(
//         expect.objectContaining({
//           token,
//           instance: mockEnricher.type,
//           data: mockMappedResult.data,
//           raw_data: mockMappedResult.raw_data
//         })
//       );
//     });

//     it('should handle webhook enrichment errors', async () => {
//       const errorMessage = 'Mapping error';
//       mockEnricher.instance.parseResult.mockImplementation(() => {
//         throw new Error(errorMessage);
//       });

//       const result = await enrichWebhook(
//         mockUserResolver,
//         createEnrichedTask(),
//         token,
//         {}
//       );

//       expect(result).toEqual(
//         expect.objectContaining({
//           token,
//           instance: mockEnricher.type,
//           error: errorMessage
//         })
//       );
//     });

//     it('should throw error for invalid webhook token', async () => {
//       const invalidToken = 'invalid-token';

//       await expect(
//         enrichWebhook(mockUserResolver, mockTask, invalidToken, {})
//       ).rejects.toThrow(`No enricher found for token: ${invalidToken}`);
//     });

//     it('should handle empty results data', async () => {
//       mockEnricher.instance.parseResult.mockReturnValue({
//         data: [],
//         raw_data: []
//       });

//       const result = await enrichWebhook(
//         mockUserResolver,
//         createEnrichedTask(),
//         token,
//         []
//       );

//       expect(result).toEqual(
//         expect.objectContaining({
//           token,
//           instance: mockEnricher.type,
//           data: [],
//           raw_data: []
//         })
//       );
//     });
//   });
// });
