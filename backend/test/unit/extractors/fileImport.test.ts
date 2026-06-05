import { jest, describe, expect, it, afterEach } from '@jest/globals';
import { CsvXlsxContactEngine } from '../../../src/services/extractors/engines/FileImport';
import { DomainStatusVerificationFunction } from '../../../src/services/extractors/engines/EmailMessage';
import { TaggingEngine } from '../../../src/services/tagging/types';

describe('FileImport', () => {
  describe('extractContacts (phone-only contact handling)', () => {
    let allSettledSpy: jest.SpyInstance | undefined;

    afterEach(() => {
      allSettledSpy?.mockRestore();
      allSettledSpy = undefined;
    });

    it('should skip contacts with no email (phone-only)', async () => {
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
      expect(result.persons).toEqual([]);
      expect(domainStatusVerification).not.toHaveBeenCalled();

      const settledResults = (await allSettledSpy.mock.results[0]
        .value) as PromiseSettledResult<unknown>[];
      expect(settledResults).toHaveLength(1);
      expect(settledResults[0].status).toBe('fulfilled');
    });
  });
});
