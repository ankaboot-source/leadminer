import { describe, it, expect, jest } from '@jest/globals';
import {
  generateErrorObjectFromImapError,
  sanitizeImapInput
} from '../../src/controllers/imap.helpers';
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

describe('sanitizeImapInput', () => {
  it('should return an empty string for empty input', () => {
    expect(sanitizeImapInput('')).toBe('');
  });

  it('should return valid input without changes', () => {
    expect(sanitizeImapInput('ValidFolderName')).toBe('ValidFolderName');
  });

  it('should allow valid characters', () => {
    expect(sanitizeImapInput('Folder-Name_123')).toBe('Folder-Name_123');
  });

  it('should strip out CRLF sequences', () => {
    expect(sanitizeImapInput('Folder\r\nName')).toBe('FolderName');
    expect(sanitizeImapInput('Folder\nName')).toBe('FolderName');
  });

  it('should throw a TypeError for non-string inputs', () => {
    expect(() => sanitizeImapInput(123 as any)).toThrow(TypeError);
    expect(() => sanitizeImapInput(null as any)).toThrow(TypeError);
    expect(() => sanitizeImapInput({} as any)).toThrow(TypeError);
  });

  it('should strip leading and trailing whitespace', () => {
    expect(sanitizeImapInput('  Folder Name  ')).toBe('Folder Name');
  });

  it('should allow valid Unicode characters', () => {
    expect(sanitizeImapInput('FolderñName')).toBe('FolderñName');
  });

  it('should escape the separator at the end of folder name', () => {  
    const folderName = sanitizeImapInput('folder1/');
    expect(folderName).toBe('folder1');
  });
  

  it('should throw an error if input exceeds maximum length', () => {
    const longInput = 'A'.repeat(256); // 256 characters
    expect(() => sanitizeImapInput(longInput)).toThrow('Max length exceeded');
  });
});
