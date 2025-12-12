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
import {
  Distribution,
  TokenBucketRateLimiter
} from '../../../../src/services/rate-limiter';
import MailerCheckClient from '../../../../src/services/email-status/mailercheck/client';
import ENV from '../../../../src/config';

jest.mock('ioredis');

jest.mock('../../../../src/config', () => ({
  MAILERCHECK_API_KEY: 'sandbox',
  LEADMINER_API_LOG_LEVEL: 'debug'
}));

const MAILERCHECK_THROTTLE_REQUESTS = 5;
const MAILERCHECK_THROTTLE_INTERVAL = 0.1;
const RATE_LIMITER = new TokenBucketRateLimiter({
  executeEvenly: true,
  uniqueKey: 'email_verification_mailercheck_test',
  distribution: Distribution.Memory,
  requests: MAILERCHECK_THROTTLE_REQUESTS,
  intervalSeconds: MAILERCHECK_THROTTLE_INTERVAL
});

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
      const requests = Array.from({
        length: MAILERCHECK_THROTTLE_REQUESTS * 2
      }).map(() => client.verifyEmail('test@example.com'));

      await Promise.allSettled(requests);

      const totalTime = Date.now() - startTime;

      expect(totalTime).toBeGreaterThanOrEqual(
        MAILERCHECK_THROTTLE_INTERVAL * (requests.length - 1)
      );
    });
  });
});
