import axios from 'axios';
import { Logger } from 'winston';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import ProxyCurl, {
  Config,
  ReverseEmailLookupParams,
  ReverseEmailLookupResponse
} from '../../../../src/services/email-enrichment/proxy-curl/client';

// Mock dependencies
jest.mock('axios');

const mockLogger: Logger = {
  info: jest.fn(),
  error: jest.fn()
} as unknown as Logger;

const mockAxiosInstance = {
  get: jest.fn()
};
(axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);

describe('ProxyCurl', () => {
  const config: Config = {
    url: 'https://api.example.com',
    apiKey: 'dummy-api-key',
    rateLimiter: {
      requests: 5,
      interval: 1000,
      maxRetries: 3,
      spaced: false
    }
  };

  const proxyCurl = new ProxyCurl(config, mockLogger);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('reverseEmailLookup', () => {
    it('should retry on rate limit error', async () => {
      const params: ReverseEmailLookupParams = {
        email: 'test@example.com',
        lookup_depth: 'deep'
      };

      const rateLimitError = { response: { status: 429 } };
      const successResponse = {
        data: { email: params.email } as ReverseEmailLookupResponse
      };

      mockAxiosInstance.get
        .mockImplementationOnce(() => Promise.reject(rateLimitError))
        .mockImplementationOnce(() => Promise.reject(rateLimitError))
        .mockImplementationOnce(() => Promise.resolve(successResponse));

      const response = await proxyCurl.reverseEmailLookup(params);

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3); // Initial attempt + 2 retries
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[ProxyCurl:rateLimitRetryWithExponentialBackoff] Rate limited, retrying attempt 1 waiting 2000ms before retry'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[ProxyCurl:rateLimitRetryWithExponentialBackoff] Rate limited, retrying attempt 2 waiting 4000ms before retry'
      );
      expect(response.email).toBe(params.email);
    }, 10000);

    it('should not retry on non-rate limit error', async () => {
      const params: ReverseEmailLookupParams = {
        email: 'test@example.com',
        lookup_depth: 'deep'
      };

      mockAxiosInstance.get.mockImplementationOnce(() =>
        // eslint-disable-next-line prefer-promise-reject-errors
        Promise.reject({ response: { status: 500 } })
      );

      await expect(proxyCurl.reverseEmailLookup(params)).rejects.toThrow();
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        '[ProxyCurl:rateLimitRetryWithExponentialBackoff] Rate limited, retrying attempt 1 waiting 2000ms before retry'
      );
    });

    it('should limit to 10 requests every 2 seconds', async () => {
      const email = 'test@example.com';
      const params: ReverseEmailLookupParams = {
        email,
        lookup_depth: 'superficial',
        enrich_profile: 'skip'
      };

      mockAxiosInstance.get.mockReturnValue({
        data: {
          email,
          profile: {},
          last_updated: '',
          similarity_score: 0,
          linkedin_profile_url: '',
          facebook_profile_url: '',
          twitter_profile_url: ''
        }
      });

      const requests = Array.from({ length: 10 }, () =>
        proxyCurl.reverseEmailLookup(params)
      );

      const start = Date.now();
      await Promise.allSettled(requests);
      const end = Date.now();

      const duration = end - start;

      expect(duration).toBeGreaterThanOrEqual(1000);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(10);
    });
  });
});
