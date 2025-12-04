import {
  describe,
  beforeEach,
  jest,
  test,
  expect,
  afterEach
} from '@jest/globals';
import logger from '../../../../src/utils/logger';
import ZerobounceEmailStatusVerifier from '../../../../src/services/email-status/zerobounce';
import ZerobounceClient, {
  ZerobounceEmailValidationResult
} from '../../../../src/services/email-status/zerobounce/client';
import sandbox from './sandbox';
import {
  EmailStatusResult,
  Status
} from '../../../../src/services/email-status/EmailStatusVerifier';
import ENV from '../../../../src/config';
import { TokenBucketRateLimiter } from '../../../../src/services/rate-limiter/RateLimiter';

jest.mock('../../../../src/config', () => ({
  // Add real api key from zerobounce to test with real requests.
  ZEROBOUNCE_API_KEY: 'sandbox',
  LEADMINER_API_LOG_LEVEL: 'debug'
}));

const validResults: Record<string, EmailStatusResult> = {
  'toxic@example.com': {
    email: 'toxic@example.com',
    details: {
      status: 'do_not_mail',
      sub_status: 'role_based',
      source: 'zerobounce'
    },
    status: Status.INVALID
  },
  'invalid@example.com': {
    email: 'invalid@example.com',
    details: {
      status: 'invalid',
      sub_status: 'possible_typo',
      source: 'zerobounce'
    },
    status: Status.INVALID
  },
  'donotmail@example.com': {
    email: 'donotmail@example.com',
    details: {
      status: 'do_not_mail',
      sub_status: 'role_based',
      source: 'zerobounce'
    },
    status: Status.INVALID
  },
  'valid@example.com': {
    email: 'valid@example.com',
    details: {
      isDeliverable: true,
      status: 'valid',
      sub_status: '',
      source: 'zerobounce'
    },
    status: Status.VALID
  },
  'disposable@example.com': {
    email: 'disposable@example.com',
    details: {
      status: 'do_not_mail',
      sub_status: 'role_based',
      source: 'zerobounce'
    },
    status: Status.INVALID
  },
  'spamtrap@example.com': {
    email: 'spamtrap@example.com',
    details: { status: 'spamtrap', sub_status: '', source: 'zerobounce' },
    status: Status.INVALID
  },
  'unknown@example.com': {
    email: 'unknown@example.com',
    details: {
      status: 'unknown',
      sub_status: 'timeout_exceeded',
      source: 'zerobounce'
    },
    status: Status.UNKNOWN
  },
  'antispam_system@example.com': {
    email: 'antispam_system@example.com',
    details: {
      status: 'unknown',
      sub_status: 'timeout_exceeded',
      source: 'zerobounce'
    },
    status: Status.UNKNOWN
  },
  'failed_smtp_connection@example.com': {
    email: 'failed_smtp_connection@example.com',
    details: {
      status: 'unknown',
      sub_status: 'timeout_exceeded',
      source: 'zerobounce'
    },
    status: Status.UNKNOWN
  },
  'exception_occurred@example.com': {
    email: 'exception_occurred@example.com',
    details: {
      status: 'unknown',
      sub_status: 'timeout_exceeded',
      source: 'zerobounce'
    },
    status: Status.UNKNOWN
  },
  'abuse@example.com': {
    email: 'abuse@example.com',
    details: { status: 'abuse', sub_status: '', source: 'zerobounce' },
    status: Status.INVALID
  },
  'mail_server_did_not_respond@example.com': {
    email: 'mail_server_did_not_respond@example.com',
    details: {
      status: 'unknown',
      sub_status: 'timeout_exceeded',
      source: 'zerobounce'
    },
    status: Status.UNKNOWN
  },
  'forcible_disconnect@example.com': {
    email: 'forcible_disconnect@example.com',
    details: {
      status: 'unknown',
      sub_status: 'timeout_exceeded',
      source: 'zerobounce'
    },
    status: Status.UNKNOWN
  },
  'greylisted@example.com': {
    email: 'greylisted@example.com',
    details: {
      status: 'unknown',
      sub_status: 'timeout_exceeded',
      source: 'zerobounce'
    },
    status: Status.UNKNOWN
  },
  'leading_period_removed@example.com': {
    email: 'leading_period_removed@example.com',
    details: {
      isDeliverable: true,
      status: 'valid',
      sub_status: '',
      source: 'zerobounce'
    },
    status: Status.VALID
  },
  'does_not_accept_mail@example.com': {
    email: 'does_not_accept_mail@example.com',
    details: {
      status: 'invalid',
      sub_status: 'possible_typo',
      source: 'zerobounce'
    },
    status: Status.INVALID
  },
  'catch_all@example.com': {
    email: 'catch_all@example.com',
    details: {
      isCatchAll: true,
      status: 'catch-all',
      sub_status: '',
      source: 'zerobounce'
    },
    status: Status.UNKNOWN
  },
  'failed_syntax_check@example.com': {
    email: 'failed_syntax_check@example.com',
    details: {
      status: 'invalid',
      sub_status: 'possible_typo',
      source: 'zerobounce'
    },
    status: Status.INVALID
  },
  'mailbox_quota_exceeded@example.com': {
    email: 'mailbox_quota_exceeded@example.com',
    details: {
      status: 'invalid',
      sub_status: 'possible_typo',
      source: 'zerobounce'
    },
    status: Status.INVALID
  },
  'mailbox_not_found@example.com': {
    email: 'mailbox_not_found@example.com',
    details: {
      status: 'invalid',
      sub_status: 'possible_typo',
      source: 'zerobounce'
    },
    status: Status.INVALID
  },
  'global_suppression@example.com': {
    email: 'global_suppression@example.com',
    details: {
      status: 'do_not_mail',
      sub_status: 'role_based',
      source: 'zerobounce'
    },
    status: Status.INVALID
  },
  'mail_server_temporary_error@example.com': {
    email: 'mail_server_temporary_error@example.com',
    details: {
      status: 'unknown',
      sub_status: 'timeout_exceeded',
      source: 'zerobounce'
    },
    status: Status.UNKNOWN
  },
  'free_email@example.com': {
    email: 'free_email@example.com',
    details: {
      isDeliverable: true,
      status: 'valid',
      sub_status: '',
      source: 'zerobounce'
    },
    status: Status.VALID
  },
  'no_dns_entries@example.com': {
    email: 'no_dns_entries@example.com',
    details: {
      status: 'invalid',
      sub_status: 'possible_typo',
      source: 'zerobounce'
    },
    status: Status.INVALID
  },
  'timeout_exceeded@example.com': {
    email: 'timeout_exceeded@example.com',
    details: {
      status: 'unknown',
      sub_status: 'timeout_exceeded',
      source: 'zerobounce'
    },
    status: Status.UNKNOWN
  },
  'role_based_catch_all@example.com': {
    email: 'role_based_catch_all@example.com',
    details: {
      status: 'do_not_mail',
      sub_status: 'role_based',
      source: 'zerobounce'
    },
    status: Status.INVALID
  },
  'possible_trap@example.com': {
    email: 'possible_trap@example.com',
    details: {
      status: 'do_not_mail',
      sub_status: 'role_based',
      source: 'zerobounce'
    },
    status: Status.INVALID
  },
  'unroutable_ip_address@example.com': {
    email: 'unroutable_ip_address@example.com',
    details: {
      status: 'invalid',
      sub_status: 'possible_typo',
      source: 'zerobounce'
    },
    status: Status.INVALID
  },
  'role_based@example.com': {
    email: 'role_based@example.com',
    details: {
      status: 'do_not_mail',
      sub_status: 'role_based',
      source: 'zerobounce'
    },
    status: Status.INVALID
  },
  'possible_typo@example.com': {
    email: 'possible_typo@example.com',
    details: {
      status: 'invalid',
      sub_status: 'possible_typo',
      source: 'zerobounce'
    },
    status: Status.INVALID
  }
};

const ZEROBOUNCE_THROTTLE_REQUESTS = 1;
const ZEROBOUNCE_THROTTLE_INTERVAL = 100;

const RATE_LIMITER = new TokenBucketRateLimiter(
  ZEROBOUNCE_THROTTLE_REQUESTS,
  ZEROBOUNCE_THROTTLE_INTERVAL
);

describe('ZerobounceEmailStatusVerifier', () => {
  let client: ZerobounceClient;
  let verifier: ZerobounceEmailStatusVerifier;

  beforeEach(() => {
    client = new ZerobounceClient(
      { apiToken: ENV.ZEROBOUNCE_API_KEY as string },
      RATE_LIMITER,
      RATE_LIMITER,
      logger
    );

    if (ENV.ZEROBOUNCE_API_KEY === 'sandbox') {
      // Mock responses
      jest
        .spyOn(client, 'verifyEmail')
        .mockImplementation((email) =>
          Promise.resolve(sandbox[email.email_address])
        );

      jest.spyOn(client, 'verifyEmailBulk').mockImplementation((emails) =>
        Promise.resolve({
          email_batch: emails.map(({ email_address: email }) => sandbox[email])
        })
      );
    }
    verifier = new ZerobounceEmailStatusVerifier(client, logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('ZerobounceEmailStatusVerifier.verify()', () => {
    test.each(Object.values(validResults))(
      'verifies %p correctly',
      async (emailData) => {
        const result = await verifier.verify(emailData.email);
        expect(result.status).toEqual(emailData.status);
      }
    );

    test('Handles throws error on insufficient credits', async () => {
      jest.spyOn(client, 'verifyEmail').mockImplementation(() =>
        Promise.resolve({
          error: 'Invalid API Key or your account ran out of credits'
        } as unknown as ZerobounceEmailValidationResult)
      );

      await expect(verifier.verify('test@example.com')).rejects.toThrow(
        'Insufficient Credits.'
      );
    });

    test('Throw when rate limited', async () => {
      jest.spyOn(client, 'verifyEmail').mockRejectedValue({
        error: 'rate limited',
        response: { status: 429 },
        isAxiosError: true
      });

      await expect(verifier.verify('test@example.com')).rejects.toThrow(
        'API rate limit exceeded'
      );
    });
  });

  describe('ZerobounceEmailStatusVerifier.verifyMany()', () => {
    test('verifies sandbox emails in bulk correctly.', async () => {
      const result = await verifier.verifyMany(Object.keys(validResults));
      expect(result).toEqual(Object.values(validResults));
    });

    test('Handles throws error on insufficient credits', async () => {
      jest.spyOn(client, 'verifyEmailBulk').mockImplementation(() =>
        Promise.resolve({
          email_batch: [],
          errors: [
            {
              email_address: 'all',
              error: 'Invalid API Key or your account ran out of credits'
            }
          ]
        })
      );

      await expect(
        verifier.verifyMany(Object.keys(validResults))
      ).rejects.toThrow('Insufficient Credits.');
    });

    test('Throw when rate limited', async () => {
      jest.spyOn(client, 'verifyEmailBulk').mockRejectedValue({
        error: 'rate limited',
        response: { status: 429 },
        isAxiosError: true
      });
      await expect(verifier.verifyMany(['test@example.com'])).rejects.toThrow(
        'API rate limit exceeded'
      );
    });
  });
});
