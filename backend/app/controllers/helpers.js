/**
 * Returns an object containing error messages for IMAP errors
 * @returns {object} - an object containing error messages and status codes for IMAP errors
 */
const getImapErrorMessages = () => {
  return {
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
  };
};

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

module.exports = {
  getImapErrorMessages,
  getXImapHeaderField
};
