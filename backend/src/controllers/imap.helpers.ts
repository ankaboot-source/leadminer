import Connection from 'imap';
import ImapConnectionProvider from '../services/imap/ImapConnectionProvider';
import { ImapAuthError } from '../utils/errors';
import logger from '../utils/logger';

const IMAP_ERROR_CODES = new Map([
  [
    'authentication',
    {
      status: 401,
      fields: ['email', 'password'],
      message:
        'Authentication failed. Please check your email address and password and try again.'
    }
  ],
  [
    'authentication-disabled',
    {
      status: 402,
      fields: ['host', 'port'],
      message:
        'Logging in is disabled on this server. Please use different host and port settings.'
    }
  ],
  [
    'authentication-app-password',
    {
      status: 401,
      fields: ['password'],
      message: 'Application-specific password is required.'
    }
  ],
  [
    'socket',
    {
      status: 503,
      fields: ['host', 'port'],
      message:
        'Could not establish a connection to the server. Please verify your host and port settings.'
    }
  ],
  [
    'timeout',
    {
      status: 504,
      fields: ['host', 'port'],
      message: 'Connection timed out while attempting to connect to the server.'
    }
  ]
]);

/**
 * Generates a new error object from a given IMAP error code or text code.
 * @param error - The IMAP error object.
 * @returns - The new error object with the corresponding error message, or the original error object.
 */
export function generateErrorObjectFromImapError(error: any) {
  let errorMessage = IMAP_ERROR_CODES.get(`${error.source}`);

  if (error.source?.startsWith('timeout')) {
    errorMessage = IMAP_ERROR_CODES.get('timeout');
  }

  if (error.message?.toLowerCase().includes('logging in is disabled')) {
    errorMessage = IMAP_ERROR_CODES.get('authentication-disabled');
  }

  if (error.message?.toLowerCase().includes('application-specific password')) {
    errorMessage = IMAP_ERROR_CODES.get('authentication-app-password');
  }

  return errorMessage
    ? new ImapAuthError(
        errorMessage.message,
        errorMessage.status,
        errorMessage.fields
      )
    : error;
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
): Promise<{
  connectionProvider: ImapConnectionProvider;
  connection: Connection;
}> {
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
    try {
      // If Unauthorized, try username.
      if (!(error instanceof ImapAuthError && error.status === 401))
        throw error;
      [login] = email.split('@');
      if (login === email) throw error;
      logger.error('Failed to log in, trying username instead of email...');
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
