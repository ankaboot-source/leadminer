import { jest, describe, expect, it, afterEach } from '@jest/globals';
import { Logger } from 'winston';
import { PostgreSQLContactEngine } from '../../../src/services/extractors/engines/PostgreSQLImport';
import { DomainStatusVerificationFunction } from '../../../src/services/extractors/engines/EmailMessage';
import { TaggingEngine } from '../../../src/services/tagging/types';
import { PostgresQueryService } from '../../../src/services/postgresql/PostgresQueryService';
import { REACHABILITY } from '../../../src/utils/constants';

jest.mock('../../../src/services/postgresql/PostgresQueryService', () => ({
  PostgresQueryService: jest.fn().mockImplementation(() => ({
    executeQueryStream: async function* mockStream() {
      yield {
        columns: ['email', 'phone'],
        rows: [{ email: 'placeholder@example.com', phone: '+1234567890' }],
        rowCount: 1
      };
    }
  }))
}));

describe('PostgreSQLImport', () => {
  describe('getContacts (phone-only contact handling)', () => {
    let allSettledSpy: jest.SpyInstance | undefined;

    afterEach(() => {
      allSettledSpy?.mockRestore();
      allSettledSpy = undefined;
      jest.restoreAllMocks();
      (PostgresQueryService as unknown as jest.Mock).mockClear();
    });

    it('should process phone-only contacts (no email) and assign a personal tag', async () => {
      const domainStatusVerification = jest
        .fn()
        .mockResolvedValue([
          true,
          'corporate'
        ]) as unknown as DomainStatusVerificationFunction;

      const taggingEngine = {
        tags: [],
        getTags: jest.fn().mockReturnValue([])
      } as unknown as TaggingEngine;

      const stubLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      } as unknown as Logger;

      const engine = new PostgreSQLContactEngine(
        taggingEngine,
        {} as never,
        domainStatusVerification,
        stubLogger,
        {
          query: 'SELECT email, phone FROM contacts',
          mapping: { email: 'email', phone: 'telephone' },
          credentials: {} as never,
          sourceName: 'test-source'
        }
      );

      jest
        .spyOn(
          engine as never as { extractPerson: () => unknown },
          'extractPerson'
        )
        .mockReturnValue({
          name: 'Phone Only',
          email: null,
          telephone: '+1234567890',
          source: 'test-source'
        });

      allSettledSpy = jest.spyOn(Promise, 'allSettled');

      const result = await engine.getContacts();
      expect(result.persons).toHaveLength(1);
      expect(result.persons[0].person.name).toBe('Phone Only');
      expect(result.persons[0].person.email).toBeNull();
      expect(result.persons[0].person.telephone).toBe('+1234567890');
      expect(result.persons[0].tags).toEqual([
        {
          name: 'personal',
          reachable: REACHABILITY.DIRECT_PERSON,
          source: 'refined#phone_only'
        }
      ]);
      expect(domainStatusVerification).not.toHaveBeenCalled();
      expect(taggingEngine.getTags).not.toHaveBeenCalled();

      const settledResults = (await allSettledSpy.mock.results[0]
        .value) as PromiseSettledResult<unknown>[];
      expect(settledResults).toHaveLength(1);
      expect(settledResults[0].status).toBe('fulfilled');
    });
  });
});
