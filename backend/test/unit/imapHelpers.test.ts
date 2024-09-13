import { describe, it, expect, jest } from '@jest/globals';
import { generateErrorObjectFromImapError } from '../../src/controllers/helpers';
import { ImapAuthError } from '../../src/utils/errors';

jest.mock('../../src/config', () => ({
  IMAP_CONNECTION_TIMEOUT: 1000,
  IMAP_AUTH_TIMEOUT: 1000
}));

describe('generateErrorObjectFromImapError', () => {
  const testCases = [
    {
      description: 'authentication error',
      error: { source: 'authentication' },
      expectedStatus: 401,
      expectedFields: ['email', 'password']
    },
    {
      description: 'authentication-disabled error',
      error: { message: 'Logging in is disabled' },
      expectedStatus: 402,
      expectedFields: ['host', 'port']
    },
    {
      description: 'application-specific-password error',
      error: {
        source: 'authentication',
        message: 'application-specific password is required'
      },
      expectedStatus: 401,
      expectedFields: ['password']
    },
    {
      description: 'connect error',
      error: { source: 'socket' },
      expectedStatus: 503,
      expectedFields: ['host', 'port']
    },
    {
      description: 'timeout error',
      error: { source: 'timeout' },
      expectedStatus: 504,
      expectedFields: ['host', 'port']
    },
    {
      description: 'unknown',
      error: { source: 'unknown', message: 'Unknown error occurred' }
    },
    {
      description: 'unknown',
      error: {}
    }
  ];

  testCases.forEach(
    ({ description, error, expectedStatus, expectedFields }) => {
      it(`should handle ${description} with status ${expectedStatus} and fields ${JSON.stringify(
        expectedFields
      )}`, () => {
        const result = generateErrorObjectFromImapError(error);
        if (description === 'unknown') {
          expect(result).toEqual(error);
        } else {
          expect(result).toBeInstanceOf(ImapAuthError);
          expect(result.status).toEqual(expectedStatus);
          expect(result.fields).toEqual(expectedFields);
        }
      });
    }
  );
});
