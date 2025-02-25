import axios from 'axios';
import { Logger } from 'winston';
import {
  jest,
  describe,
  beforeEach,
  afterEach,
  expect,
  it
} from '@jest/globals';
import MockAdapter from 'axios-mock-adapter';
import ZerobounceClient from '../../../../src/services/email-status/zerobounce/client';
import sandbox from './sandbox';
import { TokenBucketRateLimiter } from '../../../../src/services/rate-limiter/RateLimiter';

const ZEROBOUNCE_THROTTLE_REQUESTS = 1;
const ZEROBOUNCE_THROTTLE_INTERVAL = 100;
const RATE_LIMITER = new TokenBucketRateLimiter(
  ZEROBOUNCE_THROTTLE_REQUESTS,
  ZEROBOUNCE_THROTTLE_INTERVAL
);

const LOGGER = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
} as unknown as Logger;

describe('ZerobounceClient', () => {
  let axiosAdapter: MockAdapter;
  let client: ZerobounceClient;

  beforeEach(() => {
    axiosAdapter = new MockAdapter(axios);
    client = new ZerobounceClient(
      { apiToken: 'test-api-token' },
      RATE_LIMITER,
      RATE_LIMITER,
      LOGGER
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    axiosAdapter.restore();
  });

  describe('verifyEmail', () => {
    it('Call the API with the correct headers & params', async () => {
      let initiatedGetRequest = false;
      const testcase = {
        email_address: 'valid@example.com',
        ip_address: null
      };

      axiosAdapter.onGet().reply((config) => {
        initiatedGetRequest = true;

        expect(config.params.api_key).toBe('test-api-token');
        expect(config.url).toBe('validate');

        expect(config.params.email).toEqual(testcase.email_address);
        expect(config.params.ip_address).toEqual('');

        return [200, sandbox['valid@example.com']];
      });

      await client.verifyEmail(testcase);

      expect(initiatedGetRequest).toBeTruthy();
    });

    it('should properly use rate limiter', async () => {
      axiosAdapter.onAny().reply(200, { valid: true });

      const startTime = Date.now();
      const requests = [
        await client.verifyEmail({
          email_address: 'test@example.com',
          ip_address: ''
        }),
        await client.verifyEmail({
          email_address: 'test@example.com',
          ip_address: ''
        }),
        await client.verifyEmail({
          email_address: 'test@example.com',
          ip_address: ''
        })
      ];
      const totalTime = Date.now() - startTime;

      expect(totalTime).toBeGreaterThanOrEqual(
        ZEROBOUNCE_THROTTLE_INTERVAL * (requests.length - 1)
      );
    });
  });

  describe('verifyEmailBulk', () => {
    it('Call the API with correct body and batched emails', async () => {
      let initiatedPostRequest = false;

      const testcase = {
        email_address: 'valid@example.com',
        ip_address: null
      };

      axiosAdapter.onPost().reply((config) => {
        initiatedPostRequest = true;
        expect(config.url).toBe('validatebatch');
        expect(config.data).toEqual(
          JSON.stringify({
            body: {
              email_batch: [testcase],
              api_key: 'test-api-token'
            }
          })
        );

        return [200, { email_batch: sandbox['valid@example.com'] }];
      });

      await client.verifyEmailBulk([testcase]);

      expect(initiatedPostRequest).toBeTruthy();
    });

    it('should properly use rate limiter', async () => {
      axiosAdapter.onAny().reply(200, { valid: true });

      const startTime = Date.now();
      const requests = [
        await client.verifyEmail({
          email_address: 'test@example.com',
          ip_address: ''
        }),
        await client.verifyEmail({
          email_address: 'test@example.com',
          ip_address: ''
        }),
        await client.verifyEmail({
          email_address: 'test@example.com',
          ip_address: ''
        })
      ];
      const totalTime = Date.now() - startTime;

      expect(totalTime).toBeGreaterThanOrEqual(
        ZEROBOUNCE_THROTTLE_INTERVAL * (requests.length - 1)
      );
    });

    it('Throws error when passing the maximum emails per request', async () => {
      const emailBatch = [
        { email_address: 'test1@example.com', ip_address: '123.123.123.123' }
      ];
      emailBatch.length = ZerobounceClient.BATCH_VALIDATION_LENGTH + 1;
      await expect(client.verifyEmailBulk(emailBatch)).rejects.toThrow(
        `Maximum emails to validate per request is ${ZerobounceClient.BATCH_VALIDATION_LENGTH}`
      );
    });
  });
});
