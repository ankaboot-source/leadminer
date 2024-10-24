import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  enrichPersonSync,
  enrichSync,
  enrichWebhook,
  TaskEnrich
} from '../../../src/controllers/enrichment.helpers';
import { Users } from '../../../src/db/interfaces/Users';
import { Contact, Person } from '../../../src/db/types';
import emailEnrichmentService from '../../../src/services/email-enrichment';

jest.mock('../../../src/config', () => ({
  LEADMINER_API_LOG_LEVEL: 'error',
  SUPABASE_PROJECT_URL: 'fake',
  SUPABASE_SECRET_PROJECT_TOKEN: 'fake'
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnValue({ data: [], error: null }),
    insert: jest.fn().mockReturnValue({ data: null, error: null }),
    upsert: jest.fn().mockReturnValue({ data: null, error: null }),
    update: jest.fn().mockReturnValue({ data: null, error: null }),
    delete: jest.fn().mockReturnValue({ data: null, error: null }),
    rpc: jest.fn().mockReturnValue({ data: null, error: null })
  })
}));

// Test data factories with proper typing
const createMockContact = (email: string, name?: string): Partial<Contact> => ({
  email,
  ...(name && { name })
});

const createMockTask = (overrides = {}): TaskEnrich => ({
  id: 'task-123',
  user_id: 'user-123',
  status: 'running',
  category: 'enriching',
  type: 'enrich',
  started_at: null,
  stopped_at: null,
  details: {
    total_enriched: 0,
    total_to_enrich: 2,
    update_empty_fields_only: true,
    result: []
  },
  ...overrides
});

const createMockEnricher = (
  type: string,
  ruleFn: (contact: Partial<Person>) => boolean
) => ({
  type,
  default: false,
  rule: jest.fn(ruleFn),
  instance: {
    enrichSync: jest.fn((contact: Partial<Person>) => ({
      instance: type,
      data: [
        {
          email: contact.email,
          name: contact.name,
          organization: 'Test Corp'
        }
      ],
      raw_data: [{ someData: 'value' }]
    })),
    enrichmentMapper: jest.fn()
  }
});

jest.mock('../../../src/services/email-enrichment', () => ({
  getEnricher: jest.fn((_, type: string) => {
    switch (type) {
      case 'thedig':
        return createMockEnricher(
          type,
          (contact) => Boolean(contact.email) && Boolean(contact.name)
        );
      default:
        return createMockEnricher(type, (contact) => Boolean(contact.email));
    }
  })
}));

describe('Enrichment Functions', () => {
  // skipcq: JS-0323 usage of the any
  let mockEnricher: any;
  let mockTask: TaskEnrich;
  let mockUserResolver: Users;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUserResolver = {} as Users;
    mockTask = createMockTask();
    mockEnricher = createMockEnricher(
      'thedig',
      (contact) => Boolean(contact.email) && Boolean(contact.name)
    );
  });

  describe('enrichSync: Single enrichment request', () => {
    it('should successfully enrich contacts', async () => {
      const contactsToEnrich = [
        createMockContact('test1@example.com', 'Test User 1'),
        createMockContact('test2@example.com', 'Test User 2')
      ];

      const [results, notEnriched] = await enrichSync({
        userResolver: mockUserResolver,
        enricher: mockEnricher,
        contacts: contactsToEnrich
      });
      expect(results).toHaveLength(2);
      results.forEach((r) => expect(r.instance).toEqual(mockEnricher.type));
      expect(notEnriched).toHaveLength(0);
      expect(mockEnricher.rule).toHaveBeenCalledTimes(2);
    });

    it('should return non-enriched contacts', async () => {
      const contactsToEnrich = [
        createMockContact('test1@example.com'), // not enriched due to rule
        createMockContact('test2@example.com', 'Test User 2') // enriched,
      ];
      const [results, notEnriched] = await enrichSync({
        userResolver: mockUserResolver,
        enricher: mockEnricher,
        contacts: contactsToEnrich
      });

      expect(results).toHaveLength(1);
      expect(notEnriched).toHaveLength(1);
      expect(notEnriched[0]).toEqual(contactsToEnrich[0]);
      expect(mockEnricher.rule).toHaveBeenCalledTimes(2);
    });

    it('should return contacts as non-enriched on error', async () => {
      const contactsToEnrich = [
        createMockContact('test1@example.com'), // not enriched
        createMockContact('test2@example.com', 'Test User 2') // not enriched,
      ];
      const errorMessage = 'API Error';
      mockEnricher.instance.enrichSync.mockRejectedValue(
        new Error(errorMessage)
      );

      const [results, notEnriched] = await enrichSync({
        userResolver: mockUserResolver,
        enricher: mockEnricher,
        contacts: contactsToEnrich
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(
        expect.objectContaining({
          error: errorMessage,
          instance: mockEnricher.type
        })
      );
      expect(notEnriched).toEqual(contactsToEnrich);
    });

    it('should handle empty contact list', async () => {
      const [results, notEnriched] = await enrichSync({
        userResolver: mockUserResolver,
        enricher: mockEnricher,
        contacts: []
      });

      expect(results).toHaveLength(0);
      expect(notEnriched).toHaveLength(0);
      expect(mockEnricher.rule).not.toHaveBeenCalled();
    });
  });

  describe('enrichPersonSync', () => {
    it('should process contacts through multiple enrichers', async () => {
      const mockContacts = [
        createMockContact('test1@example.com'), // enriched by proxyCurl
        createMockContact('test2@example.com', 'Test User 2') // enriched by Thedig
      ];

      const [results, notEnriched] = await enrichPersonSync(
        mockUserResolver,
        mockTask,
        mockContacts
      );

      expect(results).toHaveLength(2);
      results.forEach((r) =>
        expect(['thedig', 'proxycurl']).toContain(r.instance)
      );
      expect(notEnriched).toHaveLength(0);
    });

    it('should throw error when no enrichers are available', async () => {
      const mockContacts = [
        createMockContact('test1@example.com'),
        createMockContact('test2@example.com', 'Test User 2')
      ];
      (emailEnrichmentService.getEnricher as jest.Mock).mockReturnValue(null);

      await expect(
        enrichPersonSync(mockUserResolver, mockTask, mockContacts)
      ).rejects.toThrow('No enrichers are available to use');
    });
  });

  describe('enrichWebhook', () => {
    const token = 'webhook-token';
    const createEnrichedTask = () =>
      createMockTask({
        details: {
          ...mockTask.details,
          result: [{ token, instance: 'thedig' }]
        }
      });

    beforeEach(() => {
      (emailEnrichmentService.getEnricher as jest.Mock).mockReturnValue(
        mockEnricher
      );
    });

    it('should process webhook enrichment results successfully', async () => {
      const mockResults = [
        {
          email: 'test1@example.com',
          company: 'Test Corp'
        }
      ];

      const mockMappedResult = {
        data: [{ email: 'test1@example.com', organization: 'Test Corp' }],
        raw_data: mockResults
      };

      mockEnricher.instance.enrichmentMapper.mockReturnValue(mockMappedResult);

      const result = await enrichWebhook(
        mockUserResolver,
        createEnrichedTask(),
        token,
        mockResults
      );

      expect(result).toEqual(
        expect.objectContaining({
          token,
          instance: mockEnricher.type,
          data: mockMappedResult.data,
          raw_data: mockMappedResult.raw_data
        })
      );
    });

    it('should handle webhook enrichment errors', async () => {
      const errorMessage = 'Mapping error';
      mockEnricher.instance.enrichmentMapper.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      const result = await enrichWebhook(
        mockUserResolver,
        createEnrichedTask(),
        token,
        {}
      );

      expect(result).toEqual(
        expect.objectContaining({
          token,
          instance: mockEnricher.type,
          error: errorMessage
        })
      );
    });

    it('should throw error for invalid webhook token', async () => {
      const invalidToken = 'invalid-token';

      await expect(
        enrichWebhook(mockUserResolver, mockTask, invalidToken, {})
      ).rejects.toThrow(`No enricher found for token: ${invalidToken}`);
    });

    it('should handle empty results data', async () => {
      mockEnricher.instance.enrichmentMapper.mockReturnValue({
        data: [],
        raw_data: []
      });

      const result = await enrichWebhook(
        mockUserResolver,
        createEnrichedTask(),
        token,
        []
      );

      expect(result).toEqual(
        expect.objectContaining({
          token,
          instance: mockEnricher.type,
          data: [],
          raw_data: []
        })
      );
    });
  });
});
