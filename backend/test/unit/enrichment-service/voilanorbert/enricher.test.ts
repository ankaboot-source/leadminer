import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest
} from '@jest/globals';
import { Logger } from 'winston';
import { Person } from '../../../../src/db/types';
import VoilanorbertEmailEnricher from '../../../../src/services/email-enrichment/voilanorbert';
import Voilanorbert, {
  VoilanorbertWebhookResult
} from '../../../../src/services/email-enrichment/voilanorbert/client';

jest.mock('../../../../src/services/email-enrichment/voilanorbert/client');

describe('VoilanorbertEmailEnricher', () => {
  let enricher: VoilanorbertEmailEnricher;
  const mockLogger = {
    debug: jest.fn(),
    error: jest.fn()
  } as unknown as Logger;
  const mockClient = {
    enrich: jest.fn(),
    enrichBulk: jest.fn()
  } as Partial<jest.Mocked<Voilanorbert>> as jest.Mocked<Voilanorbert>;

  beforeEach(() => {
    enricher = new VoilanorbertEmailEnricher(mockClient, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('enrichAsync', () => {
    it('should successfully call client.enrich and handle the response', async () => {
      const persons: Partial<Person>[] = [
        { email: 'test1@example.com' },
        { email: 'test2@example.com' }
      ];
      const webhook = 'test-webhook';
      const mockResponse = {
        success: true,
        token: 'testToken',
        status: 'ok'
      };

      mockClient.enrich.mockResolvedValue(mockResponse);

      const result = await enricher.enrichAsync(persons, webhook);

      expect(mockClient.enrich).toHaveBeenCalledWith(
        ['test1@example.com', 'test2@example.com'],
        webhook
      );
      expect(result).toEqual(mockResponse);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Got VoilanorbertEmailEnricher.enrichAsync request',
        persons
      );
    });

    it('should throw an error if client.enrich fails', async () => {
      const persons: Partial<Person>[] = [{ email: 'test@example.com' }];
      const webhook = 'test-webhook';
      const errorMessage = 'Failed to upload emails to enrichment.';
      mockClient.enrich.mockResolvedValue({
        token: '',
        status: 'error',
        success: false
      });

      await expect(enricher.enrichAsync(persons, webhook)).rejects.toThrow(
        errorMessage
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Got VoilanorbertEmailEnricher.enrichAsync request',
        persons
      );
    });
  });

  describe('enrichmentMapper', () => {
    it('should correctly map VoilanorbertWebhookResult to EnricherResult format', () => {
      const mockWebhookResult: VoilanorbertWebhookResult = {
        id: '123',
        token: 'testToken',
        results: [
          {
            email: 'valid@example.com',
            fullName: 'Valid User',
            organization: 'Leadminer',
            title: 'Senior Developer',
            location: 'country, city',
            twitter: 'twitter.com/validUser',
            linkedin: 'linkedin.com/in/validUser',
            facebook: 'facebook.com/validUser'
          },
          {
            email: 'partial@example.com',
            fullName: 'Partial User',
            organization: 'Leadminer',
            title: 'Intern',
            location: 'country, city',
            twitter: '',
            linkedin: 'linkedin.com/in/partialUser',
            facebook: 'facebook.com/partialUser'
          },
          {
            email: 'partial2@example.com',
            fullName: 'Partial User 2',
            organization: '',
            title: '',
            location: '',
            twitter: '',
            linkedin: '',
            facebook: ''
          },
          {
            email: 'empty@example.com',
            fullName: '',
            organization: '',
            title: '',
            location: '',
            twitter: '',
            linkedin: '',
            facebook: ''
          }
        ]
      };

      const expectedMappedData = {
        data: [
          {
            email: 'valid@example.com',
            name: 'Valid User',
            location: ['country, city'],
            organization: 'Leadminer',
            jobTitle: 'Senior Developer',
            sameAs: [
              'facebook.com/validUser',
              'linkedin.com/in/validUser',
              'twitter.com/validUser'
            ],
            image: undefined
          },
          {
            email: 'partial@example.com',
            name: 'Partial User',
            location: ['country, city'],
            organization: 'Leadminer',
            jobTitle: 'Intern',
            sameAs: ['facebook.com/partialUser', 'linkedin.com/in/partialUser'],
            image: undefined
          },
          {
            email: 'partial2@example.com',
            name: 'Partial User 2',
            image: undefined,
            jobTitle: undefined,
            location: undefined,
            organization: undefined,
            sameAs: undefined
          }
        ],
        raw_data: mockWebhookResult.results
      };

      const result = enricher.enrichmentMapper(mockWebhookResult);

      expect(result).toEqual(expectedMappedData);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[VoilanorbertEmailEnricher]-[enrichmentMapper]: Parsing enrichment results',
        mockWebhookResult
      );
    });
  });
});
