import { Logger } from 'winston';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest
} from '@jest/globals';
import { Status } from '../../../../src/services/email-status/EmailStatusVerifier';
import ReacherEmailStatusVerifier from '../../../../src/services/email-status/reacher';
import ReacherClient, {
  EmailCheckOutput
} from '../../../../src/services/email-status/reacher/client';
import {
  reacherResultToEmailStatus,
  reacherResultToEmailStatusWithDetails
} from '../../../../src/services/email-status/reacher/mappers';

jest.mock('../../../../src/services/email-status/reacher/client');

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
} as unknown as Logger;

describe('ReacherEmailStatusVerifier', () => {
  let verifier: ReacherEmailStatusVerifier;
  let mockClient: jest.Mocked<ReacherClient>;

  beforeEach(() => {
    mockClient = new ReacherClient(mockLogger, {
      host: 'https://api.reacher.com',
      rateLimiter: { requests: 1, interval: 1000, spaced: true }
    }) as jest.Mocked<ReacherClient>;

    verifier = new ReacherEmailStatusVerifier(mockClient, mockLogger);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('#verify', () => {
    const verificationResponse = {
      input: 'test@example.com',
      is_reachable: 'safe',
      misc: { is_disposable: false, is_role_account: false },
      mx: { accepts_mail: true, records: ['mx.example.com'] },
      smtp: { can_connect_smtp: true, is_deliverable: true },
      syntax: {
        domain: 'example.com',
        is_valid_syntax: true,
        username: 'test'
      }
    } as any;
    it('should return successful verification result', async () => {
      mockClient.checkSingleEmail.mockResolvedValue(verificationResponse);

      const result = await verifier.verify('test@example.com');

      expect(result).toEqual({
        email: 'test@example.com',
        status: Status.VALID,
        details: {
          isDeliverable: true,
          isDisposable: false,
          isRole: false,
          source: 'reacher'
        }
      });
    });

    it('should handle generic errors', async () => {
      mockClient.checkSingleEmail.mockRejectedValue(new Error('Generic error'));

      const result = await verifier.verify(verificationResponse.input);

      expect(result).toEqual({
        email: verificationResponse.input,
        status: Status.UNKNOWN
      });
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Request timed out') as any;
      timeoutError.isAxiosError = true;
      timeoutError.code = 'ECONNABORTED';

      mockClient.checkSingleEmail.mockRejectedValue(timeoutError);

      const result = await verifier.verify(verificationResponse.input);

      expect(result).toEqual({
        email: verificationResponse.input,
        status: Status.UNKNOWN,
        details: { hasTimedOut: true }
      });
    });
  });

  describe('#defaultBulkResults', () => {
    it('should generate correct default structure', () => {
      const emails = ['test1@example.com', 'test2@example.com'];
      const results = verifier['defaultBulkResults'](emails);

      expect(results).toEqual([
        {
          email: 'test1@example.com',
          status: Status.UNKNOWN,
          details: { hasTimedOut: true }
        },
        {
          email: 'test2@example.com',
          status: Status.UNKNOWN,
          details: { hasTimedOut: true }
        }
      ]);
    });
  });
});

describe('reacherResultToEmailStatus', () => {
  const testCases = [
    {
      name: 'should return UNKNOWN for catch-all',
      details: { isCatchAll: true },
      reachability: 'safe',
      expected: Status.UNKNOWN
    },
    {
      name: 'should return RISKY for role account',
      details: { isRole: true },
      reachability: 'safe',
      expected: Status.RISKY
    },
    {
      name: 'should return RISKY for full inbox',
      details: { hasFullInbox: true },
      reachability: 'safe',
      expected: Status.RISKY
    },
    {
      name: 'should return INVALID for disposable',
      details: { isDisposable: true },
      reachability: 'safe',
      expected: Status.INVALID
    },
    {
      name: 'should prioritize role over disposable',
      details: { isDisposable: true, isRole: true },
      reachability: 'safe',
      expected: Status.RISKY
    },
    {
      name: 'should return VALID for safe reachability',
      details: {},
      reachability: 'safe',
      expected: Status.VALID
    },
    {
      name: 'should return INVALID for invalid reachability',
      details: {},
      reachability: 'invalid',
      expected: Status.INVALID
    },
    {
      name: 'should return UNKNOWN for unknown reachability',
      details: {},
      reachability: 'unknown',
      expected: Status.UNKNOWN
    },
    {
      name: 'should return RISKY for risky reachability',
      details: {},
      reachability: 'risky',
      expected: Status.RISKY
    }
  ];

  testCases.forEach(({ name, details, reachability, expected }) => {
    it(name, () => {
      const result = reacherResultToEmailStatus(
        reachability as any,
        details as any
      );
      expect(result).toBe(expected);
    });
  });
});

describe('reacherResultToEmailStatusWithDetails', () => {
  const baseResult: EmailCheckOutput = {
    input: 'test@example.com',
    is_reachable: 'safe',
    misc: {
      is_disposable: false,
      is_role_account: false
    },
    mx: {
      accepts_mail: true,
      records: ['mx.example.com']
    },
    smtp: {
      can_connect_smtp: true,
      is_deliverable: true,
      is_catch_all: false,
      is_disabled: false,
      has_full_inbox: false
    },
    syntax: {
      domain: 'example.com',
      is_valid_syntax: true,
      username: 'test'
    }
  };

  it('should map complete successful result', () => {
    const result = reacherResultToEmailStatusWithDetails(baseResult);

    expect(result).toEqual({
      email: 'test@example.com',
      status: Status.VALID,
      details: {
        isRole: false,
        isDisposable: false,
        isDisabled: false,
        isCatchAll: false,
        isDeliverable: true,
        hasFullInbox: false,
        source: 'reacher'
      }
    });
  });

  it('should handle error in misc field', () => {
    const errorResult: EmailCheckOutput = {
      ...baseResult,
      misc: {
        type: 'smtp_error',
        message: 'Connection timeout'
      }
    };

    const result = reacherResultToEmailStatusWithDetails(errorResult);

    expect(result.details).toEqual({
      isRole: undefined,
      isDisposable: undefined,
      isDisabled: false,
      isCatchAll: false,
      isDeliverable: true,
      hasFullInbox: false,
      source: 'reacher'
    });
  });

  it('should handle error in smtp field', () => {
    const errorResult: EmailCheckOutput = {
      ...baseResult,
      smtp: {
        type: 'connection_error',
        message: 'Could not connect'
      }
    };

    const result = reacherResultToEmailStatusWithDetails(errorResult);

    expect(result.details).toEqual({
      isRole: false,
      isDisposable: false,
      isDisabled: undefined,
      isCatchAll: undefined,
      isDeliverable: undefined,
      hasFullInbox: undefined,
      source: 'reacher'
    });
  });
});
