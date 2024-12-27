import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { Contact } from '../../../src/db/types';
import { Engine } from '../../../src/services/enrichment/Engine';
import Enricher from '../../../src/services/enrichment/Enricher';
import logger from '../../../src/utils/logger';

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

function createMockEnricher(name: string, isSync: boolean, isAsync: boolean) {
  return {
    name,
    isSync,
    isAsync,
    isValid: jest.fn(),
    enrichSync: jest.fn(),
    enrichAsync: jest.fn(),
    parseResult: jest.fn()
  } as jest.Mocked<Engine>;
}

describe('Enricher Class', () => {
  const mockEngineSync1 = createMockEnricher('engine-sync-1', true, false);
  const mockEngineSync2 = createMockEnricher('engine-sync-2', true, false);
  const mockEngineAsync = createMockEnricher('engine-async-1', false, true);

  const enricher = new Enricher(
    [mockEngineSync1, mockEngineSync2, mockEngineAsync],
    logger
  );

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('enrichSync', () => {
    it('should use the first valid synchronous engine to enrich a contact', async () => {
      const contact: Partial<Contact> = { email: 'test@example.com' };
      const engineResult = {
        engine: mockEngineSync1.name,
        data: [{ email: 'test@example.com', name: 'Test User' }],
        raw_data: [{ email: 'test@example.com', name: 'Test User' }]
      };
      mockEngineSync1.isValid.mockReturnValue(true);
      mockEngineSync1.enrichSync.mockResolvedValue(engineResult);

      const result = await enricher.enrichSync(contact);

      expect(mockEngineSync1.isValid).toHaveBeenCalledWith(contact);
      expect(mockEngineSync1.enrichSync).toHaveBeenCalledWith(contact);
      expect(result).toEqual(engineResult);
    });

    it('should pass to the next engine if the first is not valid', async () => {
      const contact: Partial<Contact> = { email: 'test@example.com' };
      const engineResult = {
        engine: mockEngineSync2.name,
        data: [{ email: 'test@example.com', name: 'Test User' }],
        raw_data: [{ email: 'test@example.com', name: 'Test User' }]
      };

      mockEngineSync1.isValid.mockReturnValue(false); // First engine invalid
      mockEngineSync2.isValid.mockReturnValue(true); // Second engine valid
      mockEngineSync2.enrichSync.mockResolvedValue(engineResult);

      const result = await enricher.enrichSync(contact);

      expect(mockEngineSync1.isValid).toHaveBeenCalledWith(contact);
      expect(mockEngineSync2.isValid).toHaveBeenCalledWith(contact);
      expect(mockEngineSync2.enrichSync).toHaveBeenCalledWith(contact);
      expect(result).toEqual(engineResult);
    });

    it('should pass to the next engine if the first engine returns no result', async () => {
      const contact: Partial<Contact> = { email: 'test@example.com' };
      const engineResult = {
        engine: mockEngineSync2.name,
        data: [{ email: 'test@example.com', name: 'Test User' }],
        raw_data: [{ email: 'test@example.com', name: 'Test User' }]
      };

      mockEngineSync1.isValid.mockReturnValue(true); // First engine valid
      mockEngineSync1.enrichSync.mockResolvedValue({
        engine: mockEngineSync1.name,
        data: [],
        raw_data: []
      }); // First engine returns no result
      mockEngineSync2.isValid.mockReturnValue(true); // Second engine valid
      mockEngineSync2.enrichSync.mockResolvedValue(engineResult);

      const result = await enricher.enrichSync(contact);

      expect(mockEngineSync1.isValid).toHaveBeenCalledWith(contact);
      expect(mockEngineSync1.enrichSync).toHaveBeenCalledWith(contact);
      expect(mockEngineSync2.isValid).toHaveBeenCalledWith(contact);
      expect(mockEngineSync2.enrichSync).toHaveBeenCalledWith(contact);
      expect(result).toEqual(engineResult);
    });

    it('should throw an error if no valid engines are available', async () => {
      const contact: Partial<Contact> = { email: 'test@example.com' };
      mockEngineSync1.isValid.mockReturnValue(false);
      mockEngineSync2.isValid.mockReturnValue(false);

      await expect(enricher.enrichSync(contact)).rejects.toThrow(
        'No Engines to use.'
      );
    });
  });

  describe('enrichAsync', () => {
    it('should use the first valid asynchronous engine to enrich contacts', async () => {
      const contacts: Partial<Contact>[] = [
        { email: 'test@example.com' },
        { email: 'test2@example.com' }
      ];
      const webhook = 'http://example.com/webhook';
      const engineResult = {
        engine: mockEngineAsync.name,
        token: 'mockToken',
        data: [],
        raw_data: []
      };

      mockEngineAsync.enrichAsync.mockResolvedValue(engineResult);

      const result = await enricher.enrichAsync(contacts, webhook);

      expect(mockEngineAsync.enrichAsync).toHaveBeenCalledWith(
        contacts,
        webhook
      );
      expect(result).toEqual(engineResult);
    });

    it('should throw an error if no asynchronous engines are available', async () => {
      const emptyEnricher = new Enricher(
        [createMockEnricher('engine', false, false)],
        logger
      );
      await expect(
        emptyEnricher.enrichAsync([], 'http://example.com/webhook')
      ).rejects.toThrow('No Engines to use.');
    });
  });

  describe('enrich', () => {
    it('should yield enriched results for each contact', async () => {
      const contacts: Partial<Contact>[] = [
        { email: 'test1@example.com' },
        { email: 'test2@example.com' }
      ];
      const enricherResult = [
        {
          engine: mockEngineSync1.name,
          data: [{ email: 'test1@example.com', name: 'Test User' }],
          raw_data: [{ email: 'test1@example.com', name: 'Test User' }]
        },
        {
          engine: mockEngineSync2.name,
          data: [{ email: 'test2@example.com', name: 'Test User 2' }],
          raw_data: [{ email: 'test2@example.com', name: 'Test User 2' }]
        }
      ];

      mockEngineSync1.isValid.mockReturnValue(true);
      mockEngineSync1.enrichSync
        .mockResolvedValueOnce(enricherResult[0])
        .mockResolvedValueOnce({
          engine: mockEngineSync1.name,
          data: [],
          raw_data: []
        });
      mockEngineSync2.isValid.mockReturnValue(true);
      mockEngineSync2.enrichSync.mockResolvedValueOnce(enricherResult[1]);

      const results = [];
      for await (const result of enricher.enrich(contacts)) {
        results.push(result);
      }

      expect(mockEngineSync1.enrichSync).toHaveBeenCalledTimes(2);
      expect(mockEngineSync2.enrichSync).toHaveBeenCalledTimes(1);
      expect(results).toEqual(enricherResult);
    });
  });

  describe('parseResult', () => {
    it('should parse results using the specified engine', () => {
      const result = {
        engine: mockEngineSync1.name,
        data: [{ email: 'parsed@example.com' }],
        raw_data: [{ email: 'parsed@example.com' }]
      };

      mockEngineSync1.parseResult.mockReturnValue(result);

      const parsedResult = enricher.parseResult([result], mockEngineSync1.name);

      expect(mockEngineSync1.parseResult).toHaveBeenCalledWith([result]);
      expect(parsedResult).toEqual({
        data: result.data,
        raw_data: result.raw_data
      });
    });

    it('should return empty arrays if the engine is not found', () => {
      const result = [{ key: 'value' }];

      const parsedResult = enricher.parseResult(result, 'NonExistentEngine');

      expect(parsedResult).toEqual({ data: [], raw_data: [] });
    });
  });
});
