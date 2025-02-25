import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest
} from '@jest/globals';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { Logger } from 'winston';
import { TokenBucketRateLimiter } from '../../../../src/services/rate-limiter/RateLimiter';
import MailerCheckClient from '../../../../src/services/email-status/mailercheck/client';
import ENV from '../../../../src/config';

jest.mock('../../../../src/config', () => ({
  MAILERCHECK_API_KEY: 'sandbox',
  LEADMINER_API_LOG_LEVEL: 'debug'
}));

const MAILERCHECK_THROTTLE_REQUESTS = 1;
const MAILERCHECK_THROTTLE_INTERVAL = 100;
const RATE_LIMITER = new TokenBucketRateLimiter(
  MAILERCHECK_THROTTLE_REQUESTS,
  MAILERCHECK_THROTTLE_INTERVAL
);

const LOGGER = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
} as unknown as Logger;

describe('ReacherClient', () => {
  let client: MailerCheckClient;
  let axiosAdapter: MockAdapter;

  beforeEach(() => {
    axiosAdapter = new MockAdapter(axios);
    client = new MailerCheckClient(
      { apiToken: ENV.MAILERCHECK_API_KEY as string },
      RATE_LIMITER,
      LOGGER
    );
  });

  afterEach(() => {
    axiosAdapter.restore();
    jest.clearAllMocks();
  });

  describe('#verifyEmail', () => {
    it('should properly use rate limiter', async () => {
      axiosAdapter.onAny().reply(200, { valid: true });

      const startTime = Date.now();
      const requests = [
        await client.verifyEmail('test@example.com'),
        await client.verifyEmail('test@example.com'),
        await client.verifyEmail('test@example.com')
      ];
      const totalTime = Date.now() - startTime;

      expect(totalTime).toBeGreaterThanOrEqual(
        MAILERCHECK_THROTTLE_INTERVAL * (requests.length - 1)
      );
    });
  });
});
