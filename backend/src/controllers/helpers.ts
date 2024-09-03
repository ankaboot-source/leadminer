import ImapConnectionProvider from '../services/imap/ImapConnectionProvider';
import { ImapAuthError } from '../utils/errors';

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
 * @param email - The email address to log in with.
 * @param password - The password to use for authentication.
 * @param port - The port number to connect to.
 * @throws {Error} - If there was an error connecting to the server or authenticating with the given credentials.
 */
export async function validateImapCredentials(
  host: string,
  email: string,
  password: string,
  port: number,
  tls: boolean
) {
  let connection = null;
  let connectionProvider: ImapConnectionProvider | null = null;

  try {
    connectionProvider = new ImapConnectionProvider(email).withPassword(
      host,
      password,
      tls,
      port
    );
    connection = await connectionProvider.acquireConnection();
  } catch (error) {
    try {
      // If Unauthorized, try username.
      if (!(error instanceof ImapAuthError && error.status === 401))
        throw error;
      const username = email.split('@')[0];
      if (username === email) throw error;
      console.error('Failed to log in, trying username instead of email...');
      connectionProvider = new ImapConnectionProvider(username).withPassword(
        host,
        password,
        tls,
        port
      );
      connection = await connectionProvider.acquireConnection();
    } catch (error) {
      throw generateErrorObjectFromImapError(error);
    }
  } finally {
    if (connection) {
      await connectionProvider?.releaseConnection(connection);
    }
    await connectionProvider?.cleanPool();
  }
}
