import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Logger } from 'winston';
import ThedigApi, {
  EnrichPersonResponse
} from '../../../../src/services/enrichment/thedig/client';

import { EngineResponse } from '../../../../src/services/enrichment/Engine';
import { Person } from '../../../../src/db/types';
import Thedig from '../../../../src/services/enrichment/thedig';

describe('Thedig', () => {
  let mockClient: jest.Mocked<ThedigApi>;
  let mockLogger: jest.Mocked<Logger>;
  let enricher: Thedig;

  const enrichmentResponseMock: EnrichPersonResponse = {
    email: 'test@example.com',
    name: 'Jane Doe',
    givenName: 'Jane',
    familyName: 'Doe',
    jobTitle: ['Software Engineer'],
    worksFor: ['Tech Co.'],
    image: ['https://example.com/pic.jpg'],
    homeLocation: 'City, State',
    workLocation: 'City, State',
    alternateName: ['JDoe'],
    sameAs: ['https://linkedin.com/in/janedoe'],
    identifier: ['jane.doe'],
    statusCode: 200
  };
  const enrichmentMappedMock: EngineResponse = {
    engine: 'thedig',
    data: [
      {
        email: 'test@example.com',
        name: 'Jane Doe',
        givenName: 'Jane',
        familyName: 'Doe',
        jobTitle: 'Software Engineer',
        alternateName: ['JDoe'],
        organization: 'Tech Co.',
        image: 'https://example.com/pic.jpg',
        identifiers: ['jane.doe'],
        location: 'City, State, City, State',
        sameAs: ['https://linkedin.com/in/janedoe']
      }
    ],
    raw_data: [enrichmentResponseMock]
  };

  beforeEach(() => {
    mockClient = {
      enrich: jest.fn(),
      enrichBulk: jest.fn()
    } as Partial<jest.Mocked<ThedigApi>> as jest.Mocked<ThedigApi>;

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as unknown as jest.Mocked<Logger>;

    enricher = new Thedig(mockClient, mockLogger);
  });

  describe('parseResult', () => {
    it('should map EnrichPersonResponse data correctly', () => {
      const result = enricher.parseResult([enrichmentResponseMock]);
      expect(result).toEqual(enrichmentMappedMock);
    });

    it('should map partial EnrichpersonResponse data correctly', () => {
      const enrichmentResultMock = [
        {
          email: 'valid@example.com',
          name: 'Valid User',
          givenName: 'Valid',
          familyName: 'User',
          jobTitle: ['Software Engineer'],
          worksFor: ['Leadminer'],
          image: [
            'https://x.com/validuser/profile/pic.png',
            'https://linkedin.com/in/validuser/pic.png'
          ],
          homeLocation: 'country, city',
          workLocation: 'country, city',
          alternateName: ['valid_user_123'],
          sameAs: [
            'https://linkedin.com/in/validuser',
            'https://x.com/validuser/'
          ],
          identifier: ['valid.user'],
          statusCode: 200
        },
        {
          email: 'partial@example.com',
          name: 'Partial User',
          givenName: '',
          familyName: 'User',
          worksFor: ['Leadminer'],
          workLocation: 'country, city',
          sameAs: [
            'https://linkedin.com/in/partialuser',
            'https://x.com/partialuser/'
          ],
          statusCode: 200
        },
        {
          email: 'partial2@example.com',
          name: 'Partial2 User',
          givenName: 'Partial2',
          familyName: 'User',
          worksFor: ['Leadminer'],
          statusCode: 200
        }
      ];
      const result = enricher.parseResult(enrichmentResultMock);
      expect(result).toEqual({
        engine: 'thedig',
        data: [
          {
            email: 'valid@example.com',
            name: 'Valid User',
            givenName: 'Valid',
            familyName: 'User',
            jobTitle: 'Software Engineer',
            organization: 'Leadminer',
            identifiers: ['valid.user'],
            location: 'country, city',
            sameAs: [
              'https://linkedin.com/in/validuser',
              'https://x.com/validuser/'
            ],
            alternateName: ['valid_user_123'],
            image: 'https://x.com/validuser/profile/pic.png'
          },
          {
            email: 'partial@example.com',
            name: 'Partial User',
            givenName: undefined,
            familyName: 'User',
            jobTitle: undefined,
            organization: 'Leadminer',
            identifiers: undefined,
            location: 'country, city',
            sameAs: [
              'https://linkedin.com/in/partialuser',
              'https://x.com/partialuser/'
            ],
            alternateName: undefined,
            image: undefined
          },
          {
            email: 'partial2@example.com',
            name: 'Partial2 User',
            givenName: 'Partial2',
            familyName: 'User',
            organization: 'Leadminer'
          }
        ],
        raw_data: enrichmentResultMock
      });
    });
  });

  describe('enrich', () => {
    it('should call enrich and map the response correctly', async () => {
      const person: Partial<Person> = {
        name: 'John doe',
        email: 'test@example.com'
      };

      mockClient.enrich.mockResolvedValue(enrichmentResponseMock);

      const result = await enricher.enrichSync(person);

      expect(mockClient.enrich).toHaveBeenCalledWith(person);
      expect(result).toEqual(enrichmentMappedMock);
    });

    it('should not enriched if statusCode=203 and sameAs is empty', async () => {
      const person: Partial<Person> = {
        name: 'John doe',
        email: 'test@example.com'
      };

      const response = {
        ...enrichmentResponseMock,
        sameAs: [],
        statusCode: 203
      };
      mockClient.enrich.mockResolvedValue(response);

      const result = await enricher.enrichSync(person);

      expect(mockClient.enrich).toHaveBeenCalledWith(person);
      expect(result).toEqual({
        engine: 'thedig',
        data: [],
        raw_data: [response]
      });
    });

    it('should not enriched if statusCode 203 sameAs is not empty', async () => {
      const person: Partial<Person> = {
        name: 'John doe',
        email: 'test@example.com'
      };

      const response = {
        ...enrichmentResponseMock,
        statusCode: 203
      };
      mockClient.enrich.mockResolvedValue(response);

      const result = await enricher.enrichSync(person);

      expect(mockClient.enrich).toHaveBeenCalledWith(person);
      expect(result).toEqual({
        ...enrichmentMappedMock,
        raw_data: [response]
      });
    });

    it('should throw an error if enrich fails', async () => {
      const person: Partial<Person> = { email: 'test@example.com' };
      const error = new Error('Network error');
      mockClient.enrich.mockRejectedValue(error);

      await expect(enricher.enrichSync(person)).rejects.toThrow(
        'Network error'
      );
    });
  });

  describe('enrichAsync', () => {
    it('should call enrichBulk with correct parameters and handle a successful response', async () => {
      const webhook = 'https://webhook-url.com';
      const persons: Partial<Person>[] = [
        { email: 'john@example.com', name: 'John Doe' },
        { email: 'jane@example.com', name: 'Jane Doe' }
      ];
      const mockResponse = {
        success: true,
        status: 'ok',
        token: 'test-token'
      };

      mockClient.enrichBulk.mockResolvedValue(mockResponse);

      const result = await enricher.enrichAsync(persons, webhook);

      expect(mockClient.enrichBulk).toHaveBeenCalledWith(persons, webhook);
      expect(result).toEqual({
        data: [],
        raw_data: [],
        engine: 'thedig',
        token: mockResponse.token
      });
    });

    it('should throw an error if enrichBulk fails', async () => {
      const persons: Partial<Person>[] = [
        { email: 'test@example.com', name: 'John Doe' }
      ];
      const webhook = 'https://webhook-url.com';
      const error = new Error('Network error');

      mockClient.enrichBulk.mockRejectedValue(error);

      await expect(enricher.enrichAsync(persons, webhook)).rejects.toThrow(
        'Network error'
      );
    });

    it('should throw an error if response is unsuccessful', async () => {
      const persons: Partial<Person>[] = [
        { email: 'test@example.com', name: 'John Doe' }
      ];
      const webhook = 'https://webhook-url.com';
      const mockResponse = {
        success: false,
        status: 'error',
        token: 'error-token'
      };

      mockClient.enrichBulk.mockResolvedValue(mockResponse);

      await expect(enricher.enrichAsync(persons, webhook)).rejects.toThrow(
        'Failed to upload emails to enrichment.'
      );
    });
  });
});
