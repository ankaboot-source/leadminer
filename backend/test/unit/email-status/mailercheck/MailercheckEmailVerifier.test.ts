import {
  describe,
  beforeEach,
  jest,
  afterEach,
  test,
  expect
} from '@jest/globals';
import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';
import ENV from '../../../../src/config';
import MailerCheckEmailStatusVerifier from '../../../../src/services/email-status/mailercheck';
import MailerCheckClient from '../../../../src/services/email-status/mailercheck/client';
import logger from '../../../../src/utils/logger';

jest.mock('../../../../src/config', () => ({
  MAILERCHECK_API_KEY: 'sandbox',
  LEADMINER_API_LOG_LEVEL: 'debug'
}));

describe('MailercheckEmailStatusVerifier', () => {
  let client: MailerCheckClient;
  let axiosAdapter: MockAdapter;
  let verifier: MailerCheckEmailStatusVerifier;

  beforeEach(() => {
    axiosAdapter = new MockAdapter(axios);
    client = new MailerCheckClient(
      { apiToken: ENV.MAILERCHECK_API_KEY as string },
      logger
    );

    verifier = new MailerCheckEmailStatusVerifier(client, logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('MailercheckEmailStatusVerifier.verify()', () => {
    test('Handles throws error on insufficient credits', async () => {
      axiosAdapter.onAny().replyOnce(402);
      await expect(verifier.verify('test@example.com')).rejects.toThrow(
        'Insufficient Credits.'
      );
    });
  });

  describe('MailercheckEmailStatusVerifier.verifyMany()', () => {
    test('Handles throws error on insufficient credits', async () => {
      axiosAdapter.onAny().replyOnce(402);
      await expect(verifier.verifyMany(['test@example.com'])).rejects.toThrow(
        'Insufficient Credits.'
      );
    });
  });
});
