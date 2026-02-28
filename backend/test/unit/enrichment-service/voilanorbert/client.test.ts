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
import VoilanorbertApi from '../../../../src/services/enrichment/voilanorbert/client';
import { logError } from '../../../../src/utils/axios';
import {
  Distribution,
  TokenBucketRateLimiter
} from '../../../../src/services/rate-limiter';

jest.mock('axios');

jest.mock('ioredis');

jest.mock('../../../../src/config', () => ({
  LEADMINER_API_LOG_LEVEL: 'debug'
}));

const mockAxiosInstance = {
  get: jest.fn(),
  post: jest.fn()
};
(axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);

jest.mock('../../../../src/utils/axios', () => ({
  logError: jest.fn()
}));

const VOILANORBERT_THROTTLE_REQUESTS = 5;
const VOILANORBERT_THROTTLE_INTERVAL = 0.1;

const RATE_LIMITER = new TokenBucketRateLimiter({
  executeEvenly: true,
  uniqueKey: 'email_verification_voilanorbert_test',
  distribution: Distribution.Memory,
  requests: VOILANORBERT_THROTTLE_REQUESTS,
  intervalSeconds: VOILANORBERT_THROTTLE_INTERVAL
});

describe('VoilanorbertApi', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn()
  } as unknown as Logger;
  const config = {
    url: 'https://api.voilanorbert.com',
    username: 'testUser',
    apiToken: 'testToken',
    rateLimiter: RATE_LIMITER
  };

  let voilanorbert: VoilanorbertApi;

  beforeEach(() => {
    voilanorbert = new VoilanorbertApi(config, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('enrich', () => {
    it('should successfully enrich emails', async () => {
      const emails = ['test@example.com'];
      const webhook = 'webhook-url';

      const mockResponse = {
        status: 'success',
        success: true,
        token: 'testToken'
      };

      mockAxiosInstance.post.mockReturnValue({ data: mockResponse });

      const response = await voilanorbert.enrich(emails, webhook);

      expect(response).toEqual(mockResponse);
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: config.url,
        headers: {},
        auth: {
          username: config.username,
          password: config.apiToken
        }
      });
    });

    it('should properly use rate limiter', async () => {
      const emails = [
        'test1@example.com',
        'test2@example.com',
        'test3@example.com'
      ];

      const startTime = Date.now();
      const requests = Array.from({
        length: VOILANORBERT_THROTTLE_REQUESTS * 2
      }).map(() => voilanorbert.enrich(emails, 'webhook-url'));
      await Promise.all(requests);

      const totalTime = Date.now() - startTime;

      expect(totalTime).toBeGreaterThanOrEqual(
        VOILANORBERT_THROTTLE_INTERVAL * (requests.length - 1)
      );
    });

    it('should log an error and throw it when the request fails', async () => {
      const emails = ['test@example.com'];
      const webhook = 'webhook-url';
      const mockError = new Error('Request failed');

      mockAxiosInstance.post.mockImplementation(() =>
        Promise.reject(mockError)
      );

      await expect(voilanorbert.enrich(emails, webhook)).rejects.toThrow(
        mockError
      );
      expect(logError).toHaveBeenCalledWith(
        mockError,
        expect.any(String),
        mockLogger
      );
    });
  });
});
