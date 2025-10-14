import { ImapAuthError } from './errors';

const IMAP_ERROR_CODES = new Map([
  [
    'AUTHENTICATIONFAILED',
    {
      status: 401,
      fields: ['email', 'password'],
      message:
        'Authentication failed. Please check your email address and password and try again.'
    }
  ],
  [
    'AUTHENTICATION-DISABLED',
    {
      status: 402,
      fields: ['host', 'port'],
      message:
        'Logging in is disabled on this server. Please use different host and port settings.'
    }
  ],
  [
    'AUTHENTICATION-APP-PASSWORD',
    {
      status: 401,
      fields: ['password'],
      message: 'Application-specific password is required.'
    }
  ],
  [
    'ENOTFOUND',
    {
      status: 503,
      fields: ['host', 'port'],
      message:
        'Could not establish a connection to the server. Please verify your host and port settings.'
    }
  ],
  [
    'ETIMEDOUT',
    {
      status: 504,
      fields: ['host', 'port'],
      message: 'Connection timed out while attempting to connect to the server.'
    }
  ],
  [
    'ECONNREFUSED',
    {
      status: 502,
      fields: ['host', 'port'],
      message:
        'The connection was refused by the server. Please verify IMAP service availability and firewall rules.'
    }
  ],
  [
    'EHOSTUNREACH',
    {
      status: 503,
      fields: ['host', 'port'],
      message:
        'The host is unreachable. Please check your network connection and server accessibility.'
    }
  ]
]);

/**
 * Generates a new error object from a given IMAP error code or text code.
 * @param error - The IMAP error object.
 * @returns - The new error object with the corresponding error message, or the original error object.
 */
export function generateErrorObjectFromImapError(error: any) {
  let errorMessage = IMAP_ERROR_CODES.get(
    `${error.code ?? error.serverResponseCode}`
  );

  if (error.response?.toLowerCase().includes('logging in is disabled')) {
    errorMessage = IMAP_ERROR_CODES.get('AUTHENTICATION-DISABLED');
  }

  if (error.response?.toLowerCase().includes('application-specific password')) {
    errorMessage = IMAP_ERROR_CODES.get('AUTHENTICATION-APP-PASSWORD');
  }

  return errorMessage
    ? new ImapAuthError(
        errorMessage.message,
        errorMessage.status,
        errorMessage.fields
      )
    : new ImapAuthError(error.message, 500, [
        'host',
        'port',
        'username',
        'password'
      ]);
}

/**
 * Sanitizes input to prevent IMAP injection and CRLF attacks.
 * - Removes special IMAP characters: `{}`, `"`, `\`, `(`, `)`, `*`.
 * - Strips dangerous CRLF sequences.
 * - Strips leading and trailing whitespace.
 * @param input - The input string to sanitize.
 * @returns The sanitized string.
 */
export function sanitizeImapInput(input: string): string {
  if (typeof input !== 'string') {
    throw new TypeError('Input must be a string');
  }
  // Remove CRLF characters to prevent injection
  const sanitized = input.replace(/[\r\n]+/g, '');
  // Escape trailing folder separator (if present)
  const cleaned = sanitized.replace(/\/$/, '');
  // Strip leading and trailing whitespace
  const trimmedInput = cleaned.trim();

  if (trimmedInput.length > 255) {
    // exceeds max length defined in RFC
    throw new Error('Max length exceeded');
  }
  return trimmedInput;
}
