const IMAP_ERROR_CODES = Object.freeze({
  AUTHENTICATIONFAILED: {
    code: 401,
    message:
      'Authentication failed. Please check your email and password and try again.'
  },
  ENOTFOUND: {
    code: 404,
    message: 'Host not found. Please check the server address and try again.'
  },
  ECONNREFUSED: {
    code: 503,
    message:
      'Connection was refused by the server. Please check if the server is running and if there are no firewalls blocking the connection.'
  },
  EAI_AGAIN: {
    code: 504,
    message: 'Cannot resolve. Please verify the hostname and try again.'
  },
  EAUTH: {
    code: 401,
    message:
      'Authentication failed. Please check your username and password and try again.'
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

  if (!errorMessage) {
    return !error.code ? { ...error, code: 500 } : error;
  }

  const newError = new Error(errorMessage.message);
  newError.code = errorMessage.code;
  newError.source = error.source;
  return newError;
}

module.exports = {
  generateErrorObjectFromImapError,
  getXImapHeaderField,
  getUser
};
