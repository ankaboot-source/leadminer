import {
  describe,
  beforeEach,
  jest,
  afterEach,
  expect,
  it
} from '@jest/globals';
import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';
import { Logger } from 'winston';
import ENV from '../../../../src/config';
import MailerCheckEmailStatusVerifier from '../../../../src/services/email-status/mailercheck';
import MailerCheckClient from '../../../../src/services/email-status/mailercheck/client';
import { TokenBucketRateLimiter } from '../../../../src/services/rate-limiter/RateLimiter';

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

describe('MailercheckEmailStatusVerifier', () => {
  let client: MailerCheckClient;
  let axiosAdapter: MockAdapter;
  let verifier: MailerCheckEmailStatusVerifier;

  beforeEach(() => {
    axiosAdapter = new MockAdapter(axios);
    client = new MailerCheckClient(
      { apiToken: ENV.MAILERCHECK_API_KEY as string },
      RATE_LIMITER,
      LOGGER
    );

    verifier = new MailerCheckEmailStatusVerifier(client, LOGGER);
  });

  afterEach(() => {
    axiosAdapter.restore();
    jest.clearAllMocks();
  });

  describe('MailercheckEmailStatusVerifier.verify()', () => {
    it('Handles throws error on insufficient credits', async () => {
      axiosAdapter.onAny().replyOnce(402);
      await expect(verifier.verify('test@example.com')).rejects.toThrow(
        'Insufficient Credits.'
      );
    });
  });

  describe('MailercheckEmailStatusVerifier.verifyMany()', () => {
    it('Handles throws error on insufficient credits', async () => {
      axiosAdapter.onAny().replyOnce(402);
      await expect(verifier.verifyMany(['test@example.com'])).rejects.toThrow(
        'Insufficient Credits.'
      );
    });
  });
});
