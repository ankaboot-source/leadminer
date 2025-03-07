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
import ThedigApi, {
  EnrichPersonRequest,
  EnrichPersonResponse
} from '../../../../src/services/enrichment/thedig/client';
import { TokenBucketRateLimiter } from '../../../../src/services/rate-limiter/RateLimiter';

// Mock dependencies
jest.mock('axios');
const mockAxiosInstance = {
  get: jest.fn(),
  post: jest.fn()
} as unknown as jest.Mocked<typeof axios>;
(axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);

const REACHER_THROTTLE_REQUESTS = 1;
const REACHER_THROTTLE_INTERVAL = 100;

const RATE_LIMITER = new TokenBucketRateLimiter(
  REACHER_THROTTLE_REQUESTS,
  REACHER_THROTTLE_INTERVAL
);

describe('ThedigApi', () => {
  let mockLogger: jest.Mocked<Logger>;
  let theDigClient: ThedigApi;

  beforeEach(() => {
    mockLogger = { error: jest.fn() } as unknown as jest.Mocked<Logger>;
    theDigClient = new ThedigApi(
      {
        url: 'https://api.example.com',
        apiToken: 'test-token',
        rateLimiter: RATE_LIMITER
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
        worksFor: ['Tech Inc.'],
        statusCode: 200
      };

      mockAxiosInstance.post.mockResolvedValue({ data: personResponse });

      const result = await theDigClient.enrich(personRequest);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/person/',
        personRequest
      );
      expect(result).toEqual(personResponse);
    });

    it('should properly use rate limiter', async () => {
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

      const startTime = Date.now();
      const requests = [
        await theDigClient.enrich(personRequest),
        await theDigClient.enrich(personRequest),
        await theDigClient.enrich(personRequest)
      ];
      const totalTime = Date.now() - startTime;

      expect(totalTime).toBeGreaterThanOrEqual(
        REACHER_THROTTLE_INTERVAL * (requests.length - 1)
      );
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
        expect.stringContaining('[ThedigApi:enrich]'),
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
      const personRequest = [
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
      const tolerance = 10; // Allow a 10ms margin of error to account for slight timing variations

      expect(duration).toBeGreaterThanOrEqual(1000 - tolerance);
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
        expect.stringContaining('[ThedigApi:enrichBulk]'),
        error
      );
    });
  });
});
