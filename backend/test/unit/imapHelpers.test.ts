import { describe, it, expect, jest } from '@jest/globals';
import { generateErrorObjectFromImapError } from '../../src/controllers/helpers';
import { ImapAuthError } from '../../src/utils/errors';

jest.mock('../../src/config', () => ({
  IMAP_CONNECTION_TIMEOUT: 1000,
  IMAP_AUTH_TIMEOUT: 1000
}));

describe('generateErrorObjectFromImapError', () => {
  it('should handle authentication error with status 401 and fields ["email", "password"]', () => {
    const error = { source: 'authentication' };
    const result = generateErrorObjectFromImapError(error);
    expect(result).toBeInstanceOf(ImapAuthError);
    expect(result.status).toEqual(401);
    expect(result.fields).toEqual(['email', 'password']);
  });

  it('should handle authentication-disabled error with status 402 and fields ["host", "port"]', () => {
    const error = { message: 'Logging in is disabled' };
    const result = generateErrorObjectFromImapError(error);
    expect(result).toBeInstanceOf(ImapAuthError);
    expect(result.status).toEqual(402);
    expect(result.fields).toEqual(['host', 'port']);
  });

  it('should handle connect error with status 503 and fields ["host", "port"]', () => {
    const error = { source: 'socket' };
    const result = generateErrorObjectFromImapError(error);
    expect(result).toBeInstanceOf(ImapAuthError);
    expect(result.status).toEqual(503);
    expect(result.fields).toEqual(['host', 'port']);
  });

  it('should handle timeout error with status 504 and fields ["host", "port"]', () => {
    const error = { source: 'timeout' };
    const result = generateErrorObjectFromImapError(error);
    expect(result).toBeInstanceOf(ImapAuthError);
    expect(result.status).toEqual(504);
    expect(result.fields).toEqual(['host', 'port']);
  });

  it('should return undefined status and fields for unknown error', () => {
    const error = { source: 'unknown', message: 'Unknown error occurred' };
    const result = generateErrorObjectFromImapError(error);
    expect(result.status).toBeUndefined();
    expect(result.fields).toBeUndefined();
  });
});
