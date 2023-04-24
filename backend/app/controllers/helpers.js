const {
  ImapConnectionProvider
} = require('../services/ImapConnectionProvider');

const IMAP_ERROR_CODES = Object.freeze({
  AUTHENTICATIONFAILED: {
    fields: ['email', 'password'],
    message:
      'Authentication failed. Please check your email and password and try again.'
  },
  EAUTH: {
    fields: ['email', 'password'],
    message:
      'Authentication failed. Please check your username and password and try again.'
  },
  ENOTFOUND: {
    fields: ['host'],
    message: 'Host not found. Please check the server address and try again.'
  },
  ECONNREFUSED: {
    fields: ['host', 'port'],
    message:
      'Connection was refused by the server. Please check if the server is running and if there are no firewalls blocking the connection.'
  },
  EAI_AGAIN: {
    fields: ['host'],
    message: 'Cannot resolve. Please verify the hostname and try again.'
  },
  CONNECTION_TIMEOUT: {
    fields: ['host', 'port'],
    message: 'Timed out while connecting to server.'
  }
});

/**
 * Extracts the x-imap-login header field and validates it
 * @param {Object} headers - an object containing HTTP request headers.
 * @returns {{data, error}} - an object containing the extracted values and an error object if any
 */
function getXImapHeaderField(headers) {
  if (!headers['x-imap-login']) {
    return {
      data: null,
      error: new Error('An x-imap-login header field is required.')
    };
  }
  let login = null;
  try {
    login = JSON.parse(headers['x-imap-login']);
  } catch (error) {
    return {
      data: null,
      error: new Error(
        'x-imap-login header field is not in correct JSON format'
      )
    };
  }

  if (!login.email || !login.id) {
    return {
      data: null,
      error: new Error(
        'x-imap-login header field is missing required fields (email, id)'
      )
    };
  }
  if (!login.access_token && !login.password) {
    return {
      data: null,
      error: new Error(
        'x-imap-login header field is missing the access_token or password field'
      )
    };
  }
  return { data: login, error: null };
}

/**
 * Get a user by either their access token and email or their IMAP ID or email.
 *
 * @param {Object} params - An object containing the necessary parameters to fetch a user.
 * @param {string} params.access_token - The user's Google access token.
 * @param {string} params.id - The user's IMAP ID.
 * @param {string} params.email - The user's email address.
 * @param {Object} db - The database object to use for fetching the user.
 * @returns {Promise<Object>} - A promise that resolves with the user object, or null if not found.
 * @throws {Error} - If at least one parameter is not provided.
 *
 * @example
 * const params = { id: '123', email: 'user@example.com' };
 * const user = await getUser(params);
 * console.log(user);
 */
function getUser({ access_token, id, email }, db) {
  if (!access_token && !id && !email) {
    throw new Error(
      'At least one parameter is required { access_token, id, email }.'
    );
  }

  if (access_token) {
    return db.getGoogleUserByEmail(email);
  } else if (id) {
    return db.getImapUserById(id);
  }

  return db.getImapUserByEmail(email);
}

/**
 * Generates a new error object from a given IMAP error code or text code.
 * @param {object} error - The IMAP error object.
 * @returns {object} - The new error object with the corresponding error message, or the original error object.
 */
function generateErrorObjectFromImapError(error) {
  let errorMessage = IMAP_ERROR_CODES[`${error.code ?? error.textCode}`];

  if (error.message.startsWith('LOGIN') && !(error.code ?? error.textCode)) {
    errorMessage = IMAP_ERROR_CODES.AUTHENTICATIONFAILED;
  }

  if (error.source === 'timeout') {
    errorMessage = IMAP_ERROR_CODES.CONNECTION_TIMEOUT;
  }

  if (errorMessage) {
    const newError = new Error('Imap connection error.');
    newError.errors = [
      {
        fields: errorMessage.fields,
        message: errorMessage.message
      }
    ];
    newError.source = error.source;
    return newError;
  }

  return error;
}

/**
 * Checks if the given IMAP credentials are valid by attempting to connect to the server.
 * @param {string} host - The IMAP server hostname.
 * @param {string} email - The email address to log in with.
 * @param {string} password - The password to use for authentication.
 * @param {boolean} tls - Whether or not to use TLS for the connection.
 * @param {number} port - The port number to connect to.
 * @throws {Error} - If there was an error connecting to the server or authenticating with the given credentials.
 */
async function validateImapCredentials(host, email, password, port) {
  if ([host, email, password, port].some((param) => param === undefined)) {
    throw new TypeError('Invalid parameters.');
  }

  let connection = null;
  let connectionProvider = null;

  try {
    connectionProvider = new ImapConnectionProvider(email).withPassword(
      host,
      password,
      parseInt(port)
    );
    connection = await connectionProvider.acquireConnection();
  } catch (err) {
    throw generateErrorObjectFromImapError(err);
  } finally {
    await connectionProvider?.releaseConnection(connection);
    await connectionProvider?.cleanPool();
  }
}

/**
 * Validates and extracts IMAP parameters from the request body.
 *
 * @param {object} body - The request body object containing the email, host, tls, port, and password.
 * @param {string} body.host - The host parameter.
 * @param {string} body.email - The email parameter.
 * @param {string} body.password - The password parameter.
 * @param {boolean} body.tls - The tls parameter.
 * @param {number} body.port - The port parameter.
 *
 * @returns {object} An object containing the extracted parameters.
 * @throws {Error} If any required parameter is missing or invalid, or if there is an error connecting to the IMAP server.
 */
function validateAndExtractImapParametersFromBody({
  host,
  email,
  password,
  tls,
  port
}) {
  const validationRules = [
    {
      fields: ['host'],
      message: 'Host parameter is missing or invalid',
      value: host,
      validation: (value) => typeof value === 'string'
    },
    {
      fields: ['email'],
      message: 'Email parameter is missing or invalid',
      value: email,
      validation: (value) => typeof value === 'string'
    },
    {
      fields: ['password'],
      message: 'Password parameter is missing or invalid',
      value: password,
      validation: (value) => typeof value === 'string'
    },
    {
      fields: ['tls'],
      message: 'TLS parameter is missing or invalid',
      value: tls,
      validation: (value) => typeof value === 'boolean'
    },
    {
      fields: ['port'],
      message: 'Port parameter is missing or invalid',
      value: port,
      validation: (value) => !isNaN(value)
    }
  ];

  const errors = validationRules
    .filter(({ value, validation }) => !validation(value))
    .map(({ fields, message }) => ({ fields, message }));

  if (errors.length > 0) {
    const err = new Error('Validation errors');
    err.errors = errors;
    err.code = 400;
    throw err;
  }

  return { email, host, tls, port, password };
}

module.exports = {
  validateAndExtractImapParametersFromBody,
  generateErrorObjectFromImapError,
  validateImapCredentials,
  getXImapHeaderField,
  getUser
};
