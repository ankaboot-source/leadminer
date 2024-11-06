import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest
} from '@jest/globals';
import axios from 'axios';
import { Logger } from 'winston';
import TheDig, {
  EnrichPersonRequest,
  EnrichPersonResponse
} from '../../../../src/services/email-enrichment/thedig/client';
import { Person } from '../../../../src/services/email-enrichment/EmailEnricher';

// Mock dependencies
jest.mock('axios');
const mockAxiosInstance = {
  get: jest.fn(),
  post: jest.fn()
} as unknown as jest.Mocked<typeof axios>;
(axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);

describe('TheDig', () => {
  let mockLogger: jest.Mocked<Logger>;
  let theDigClient: TheDig;

  beforeEach(() => {
    mockLogger = { error: jest.fn() } as unknown as jest.Mocked<Logger>;
    theDigClient = new TheDig(
      {
        url: 'https://api.example.com',
        apiToken: 'test-token',
        rateLimiter: {
          requests: 5,
          interval: 1000,
          spaced: false
        }
      },
      mockLogger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('enrich', () => {
    it('should return enriched person data on success', async () => {
      const personRequest: EnrichPersonRequest = {
        name: 'John Doe',
        email: 'john@example.com'
      };
      const personResponse: EnrichPersonResponse = {
        email: 'john@example.com',
        name: 'John Doe',
        givenName: 'John',
        familyName: 'Doe',
        jobTitle: ['Engineer'],
        worksFor: ['Tech Inc.']
      };

      mockAxiosInstance.post.mockResolvedValue({ data: personResponse });

      const result = await theDigClient.enrich(personRequest);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/person/',
        personRequest
      );
      expect(result).toEqual(personResponse);
    });

    it('should limit to 10 requests every 2 seconds', async () => {
      const personRequest: EnrichPersonRequest = {
        name: 'John Doe',
        email: 'john@example.com'
      };

      // Mock the Axios POST response
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          email: personRequest.email,
          name: personRequest.name
        } as EnrichPersonResponse
      });

      // Create 10 enrichment requests
      const requests = Array.from({ length: 10 }, () =>
        theDigClient.enrich(personRequest)
      );

      // Measure time taken for all requests
      const start = Date.now();
      await Promise.allSettled(requests);
      const end = Date.now();

      const duration = end - start;

      expect(duration).toBeGreaterThanOrEqual(1000);
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(10);
    });

    it('should log an error and throw if API request fails', async () => {
      const personRequest: EnrichPersonRequest = {
        name: 'John Doe',
        email: 'john@example.com'
      };
      const error = new Error('Network Error');
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(theDigClient.enrich(personRequest)).rejects.toThrow(
        'Network Error'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('[TheDig:enrich]'),
        error
      );
    });
  });

  describe('enrichBulk', () => {
    it('should return status and token on successful bulk enrichment', async () => {
      const persons = [{ email: 'john@example.com' }];
      const webhookUrl = 'https://webhook.example.com';
      const mockResponseToken = 'bulk-token-123';

      mockAxiosInstance.post.mockResolvedValue({
        data: mockResponseToken
      });

      const result = await theDigClient.enrichBulk(persons, webhookUrl);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        `/person/bulk?endpoint=${webhookUrl}`,
        persons
      );
      expect(result).toEqual({
        status: 'running',
        success: true,
        token: mockResponseToken
      });
    });

    it('should limit to 10 requests every 2 seconds', async () => {
      const personRequest: Partial<Person>[] = [
        {
          name: 'John Doe',
          email: 'john@example.com'
        },
        {
          name: 'John Doe 1',
          email: 'john@example.com'
        }
      ];

      mockAxiosInstance.post.mockResolvedValue({
        data: 'bulk-token-123'
      });

      const requests = Array.from({ length: 10 }, () =>
        theDigClient.enrichBulk(personRequest, 'webhook')
      );

      const start = Date.now();
      await Promise.allSettled(requests);
      const end = Date.now();

      const duration = end - start;

      expect(duration).toBeGreaterThanOrEqual(1000);
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(10);
    });

    it('should log an error and throw if bulk request fails', async () => {
      const persons = [{ email: 'john@example.com' }];
      const webhookUrl = 'https://webhook.example.com';
      const error = new Error('Bulk request error');
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(
        theDigClient.enrichBulk(persons, webhookUrl)
      ).rejects.toThrow('Bulk request error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('[TheDig:enrichBulk]'),
        error
      );
    });
  });
});
