import { IncomingHttpHeaders } from 'http';
import { ImapUsers } from '../db/ImapUsers';
import { OAuthUsers } from '../db/OAuthUsers';
import ImapConnectionProvider from '../services/imap/ImapConnectionProvider';
import { ImapAuthError } from '../utils/errors';

const IMAP_ERROR_CODES = new Map([
  [
    'AUTHENTICATIONFAILED',
    {
      fields: ['email', 'password'],
      message:
        'Authentication failed. Please check your email and password and try again.'
    }
  ],
  [
    'EAUTH',
    {
      fields: ['email', 'password'],
      message:
        'Authentication failed. Please check your username and password and try again.'
    }
  ],
  [
    'ENOTFOUND',
    {
      fields: ['host'],
      message: 'Host not found. Please check the server address and try again.'
    }
  ],
  [
    'ECONNREFUSED',
    {
      fields: ['host', 'port'],
      message:
        'Connection was refused by the server. Please check if the server is running and if there are no firewalls blocking the connection.'
    }
  ],
  [
    'EAI_AGAIN',
    {
      fields: ['host'],
      message: 'Cannot resolve. Please verify the hostname and try again.'
    }
  ],
  [
    'CONNECTION_TIMEOUT',
    {
      fields: ['host', 'port'],
      message: 'Timed out while connecting to server.'
    }
  ]
]);

/**
 * Extracts the x-imap-credentials header field and validates it
 * @param headers - an object containing HTTP request headers.
 * @returns an object containing the extracted values and an error object if any
 */
export function getXImapHeaderField(headers: IncomingHttpHeaders) {
  if (!headers['x-imap-credentials']) {
    return {
      error: new Error('An x-imap-credentials header field is required.')
    };
  }
  let login = null;
  try {
    login = JSON.parse(headers['x-imap-credentials'] as string);
  } catch (error) {
    return {
      error: new Error(
        'x-imap-credentials header field is not in correct JSON format'
      )
    };
  }

  if (!login.access_token && (!login.host || !login.email || !login.password)) {
    return {
      error: new Error(
        'x-imap-credentials header is missing required field. Check (host, email, password) OR (access_token)'
      )
    };
  }

  return { data: login, error: null };
}

/**
 * Get a user by either their access token and email or their IMAP ID or email.
 * @param params - User data params.
 * @param imapUsers - Imap users db accessor.
 * @param oAuthUsers - OAuth users db accessor.
 * @throws {Error} - If at least one parameter is not provided.
 */
export function getUser(
  {
    access_token,
    id,
    email
  }: {
    access_token?: string;
    id?: string;
    email?: string;
  },
  imapUsers: ImapUsers,
  oAuthUsers: OAuthUsers
) {
  if (!access_token && !id && !email) {
    throw new Error(
      'At least one parameter is required { access_token, id, email }.'
    );
  }

  if (access_token) {
    return oAuthUsers.getByEmail(email!);
  }

  if (id) {
    return imapUsers.getById(id);
  }

  return imapUsers.getByEmail(email!);
}

/**
 * Generates a new error object from a given IMAP error code or text code.
 * @param error - The IMAP error object.
 * @returns - The new error object with the corresponding error message, or the original error object.
 */
export function generateErrorObjectFromImapError(error: any) {
  let errorMessage = IMAP_ERROR_CODES.get(`${error.code ?? error.textCode}`);

  if (error.message.startsWith('LOGIN') && !(error.code ?? error.textCode)) {
    errorMessage = IMAP_ERROR_CODES.get('AUTHENTICATIONFAILED');
  }

  if (error.source === 'timeout') {
    errorMessage = IMAP_ERROR_CODES.get('CONNECTION_TIMEOUT');
  }

  if (errorMessage) {
    const fieldError = {
      fields: errorMessage.fields,
      message: errorMessage.message
    };
    const newError = new ImapAuthError('Imap connection error', fieldError);
    return newError;
  }

  return error;
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
  port: number
) {
  if ([host, email, password, port].some((param) => param === undefined)) {
    throw new TypeError('Invalid parameters.');
  }

  let connection = null;
  let connectionProvider: ImapConnectionProvider | null = null;

  try {
    connectionProvider = new ImapConnectionProvider(email).withPassword(
      host,
      password,
      port
    );
    connection = await connectionProvider.acquireConnection();
  } catch (err) {
    throw generateErrorObjectFromImapError(err);
  } finally {
    if (connection) {
      await connectionProvider?.releaseConnection(connection);
    }
    await connectionProvider?.cleanPool();
  }
}

/**
 * Validates and extracts IMAP parameters from the request body.
 *
 * @param {object} body - The request body object containing the email, host, tls, port, and password.
 * @throws {Error} If any required parameter is missing or invalid, or if there is an error connecting to the IMAP server.
 */
export function validateAndExtractImapParametersFromBody({
  host,
  email,
  password,
  tls,
  port
}: {
  host: string;
  email: string;
  password: string;
  tls: boolean;
  port: number;
}) {
  const validationRules = [
    {
      fields: ['host'],
      message: 'Host parameter is missing or invalid',
      value: host,
      validation: (value: any) => typeof value === 'string'
    },
    {
      fields: ['email'],
      message: 'Email parameter is missing or invalid',
      value: email,
      validation: (value: any) => typeof value === 'string'
    },
    {
      fields: ['password'],
      message: 'Password parameter is missing or invalid',
      value: password,
      validation: (value: any) => typeof value === 'string'
    },
    {
      fields: ['tls'],
      message: 'TLS parameter is missing or invalid',
      value: tls,
      validation: (value: any) => typeof value === 'boolean'
    },
    {
      fields: ['port'],
      message: 'Port parameter is missing or invalid',
      value: port,
      validation: (value: any) => !Number.isNaN(value)
    }
  ];

  const errors = validationRules
    .filter(({ value, validation }) => !validation(value))
    .map(({ fields, message }) => ({ fields, message }));

  if (errors.length > 0) {
    const err: any = new Error('Validation errors');
    err.errors = errors;
    err.code = 400;
    throw err;
  }

  return { email, host, tls, port, password };
}
