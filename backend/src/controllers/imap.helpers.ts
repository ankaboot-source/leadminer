import { ImapFlow as Connection } from 'imapflow';
import ImapConnectionProvider from '../services/imap/ImapConnectionProvider';
import { ImapAuthError } from '../utils/errors';
import logger from '../utils/logger';

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
 * Checks if the given IMAP credentials are valid by attempting to connect to the server.
 * @param host - The IMAP server hostname.
 * @param login - The email address or the username to log in with.
 * @param password - The password to use for authentication.
 * @param port - The port number to connect to.
 * @throws {Error} - If there was an error connecting to the server or authenticating with the given credentials.
 * @returns A promise that resolves to {connectionProvider, connection}
 */
export async function validateImapCredentials(
  host: string,
  login: string,
  password: string,
  port: number,
  tls: boolean
) {
  const connectionProvider = new ImapConnectionProvider(login).withPassword(
    host,
    password,
    tls,
    port
  );
  const connection = await connectionProvider.acquireConnection();
  return { connectionProvider, connection };
}

/**
 * Checks if the given IMAP credentials are valid by attempting to connect to the server.
 * If invalid then try username instead of email.
 * @param host - The IMAP server hostname.
 * @param email - The email address to log in with.
 * @param password - The password to use for authentication.
 * @param port - The port number to connect to.
 * @throws {Error} - If there was an error connecting to the server or authenticating with the given/created credentials.
 * @returns A promise that resolves to a `login` string, which is the `email`, if unauthorized then `username`.
 */
export async function getValidImapLogin(
  host: string,
  email: string,
  password: string,
  port: number,
  tls: boolean
): Promise<string> {
  let connection: Connection | null = null;
  let connectionProvider: ImapConnectionProvider | null = null;
  let login = email;
  try {
    ({ connectionProvider, connection } = await validateImapCredentials(
      host,
      login,
      password,
      port,
      tls
    ));
    return login;
  } catch (error) {
    const imapError = generateErrorObjectFromImapError(error);
    try {
      // If Unauthorized, try username.
      if (!(imapError.status === 401)) throw imapError;

      [login] = email.split('@');
      if (login === email) throw error;
      logger.warn('Failed to log in, trying username instead of email...');
      ({ connectionProvider, connection } = await validateImapCredentials(
        host,
        login,
        password,
        port,
        tls
      ));

      return login;
    } catch (err) {
      throw generateErrorObjectFromImapError(err);
    }
  } finally {
    if (connection) {
      await connectionProvider?.releaseConnection(connection);
    }
    await connectionProvider?.cleanPool();
  }
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
