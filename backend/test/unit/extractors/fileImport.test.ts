import { jest, describe, expect, it, afterEach } from '@jest/globals';
import { CsvXlsxContactEngine } from '../../../src/services/extractors/engines/FileImport';
import { DomainStatusVerificationFunction } from '../../../src/services/extractors/engines/EmailMessage';
import { TaggingEngine } from '../../../src/services/tagging/types';
import { REACHABILITY } from '../../../src/utils/constants';

describe('FileImport', () => {
  describe('getContacts (phone-only contact handling)', () => {
    let allSettledSpy: jest.SpyInstance | undefined;

    afterEach(() => {
      allSettledSpy?.mockRestore();
      allSettledSpy = undefined;
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

      const phoneOnlyContact = {
        name: 'Phone Only',
        email: null,
        telephone: '+1234567890'
      };

      const fileImport = new CsvXlsxContactEngine(
        taggingEngine,
        {} as never,
        domainStatusVerification,
        {
          fileName: 'contacts.csv',
          contacts: [phoneOnlyContact as unknown as never]
        }
      );

      allSettledSpy = jest.spyOn(Promise, 'allSettled');

      const result = await fileImport.getContacts();
      expect(result.persons).toHaveLength(1);
      expect(result.persons[0].person.name).toBe('Phone Only');
      expect(result.persons[0].person.email).toBeNull();
      expect(result.persons[0].person.telephone).toEqual(['+1234567890']);
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

    it('should process email contacts and skip them when domain is invalid', async () => {
      const domainStatusVerification = jest
        .fn()
        .mockResolvedValue([
          false,
          'invalid'
        ]) as unknown as DomainStatusVerificationFunction;

      const taggingEngine = {
        tags: [],
        getTags: jest.fn().mockReturnValue([])
      } as unknown as TaggingEngine;

      const emailContact = {
        name: 'Email User',
        email: 'user@invalid-domain.example',
        telephone: null
      };

      const fileImport = new CsvXlsxContactEngine(
        taggingEngine,
        {} as never,
        domainStatusVerification,
        {
          fileName: 'contacts.csv',
          contacts: [emailContact as unknown as never]
        }
      );

      const result = await fileImport.getContacts();
      expect(result.persons).toEqual([]);
      expect(domainStatusVerification).toHaveBeenCalledTimes(1);
    });
  });
});
