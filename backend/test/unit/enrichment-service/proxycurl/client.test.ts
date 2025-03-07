import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import axios from 'axios';
import { Logger } from 'winston';
import ProxycurlApi, {
  ReverseEmailLookupParams,
  ReverseEmailLookupResponse
} from '../../../../src/services/enrichment/proxy-curl/client';
import { TokenBucketRateLimiter } from '../../../../src/services/rate-limiter/RateLimiter';

jest.mock('axios');

const mockLogger: Logger = {
  info: jest.fn(),
  error: jest.fn()
} as unknown as Logger;

const mockAxiosInstance = {
  get: jest.fn()
};
(axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);

const REACHER_THROTTLE_REQUESTS = 1;
const REACHER_THROTTLE_INTERVAL = 100;

const RATE_LIMITER = new TokenBucketRateLimiter(
  REACHER_THROTTLE_REQUESTS,
  REACHER_THROTTLE_INTERVAL
);

describe('ProxycurlApi', () => {
  const config = {
    url: 'https://api.example.com',
    apiKey: 'dummy-api-key',
    rateLimiter: RATE_LIMITER
  };

  const proxyCurl = new ProxycurlApi(config, mockLogger);

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
        '[ProxycurlApi:rateLimitRetryWithExponentialBackoff] Rate limited, retrying attempt 1 waiting 2000ms before retry'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[ProxycurlApi:rateLimitRetryWithExponentialBackoff] Rate limited, retrying attempt 2 waiting 4000ms before retry'
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
        '[ProxycurlApi:rateLimitRetryWithExponentialBackoff] Rate limited, retrying attempt 1 waiting 2000ms before retry'
      );
    });

    it('should properly use rate limiter', async () => {
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

      const startTime = Date.now();
      const requests = [
        await proxyCurl.reverseEmailLookup(params),
        await proxyCurl.reverseEmailLookup(params),
        await proxyCurl.reverseEmailLookup(params)
      ];
      const totalTime = Date.now() - startTime;

      expect(totalTime).toBeGreaterThanOrEqual(
        REACHER_THROTTLE_INTERVAL * (requests.length - 1)
      );
    });
  });
});
