/* istanbul ignore file */
const xoauth2 = require('xoauth2');
const { OAuth2Client } = require('google-auth-library');
const {
  googleClientId,
  googleClientSecret
} = require('../../config/google.config');

function getOAuthClient() {
  return new OAuth2Client(googleClientId, googleClientSecret, 'postmessage');
}

/**
 * Refreshes an expired access token using a refresh token
 * @param {string} refreshToken - The stored refresh token
 * @returns {Promise<string>} The new access token
*/
async function refreshAccessToken(refreshToken) {
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  try {
    let { token } = await oauth2Client.getAccessToken();

    // Extract the access_token from the response data
    if (token.res?.data) {
      token = token.res.data.access_token;
    }

    oauth2Client.setCredentials({ token });
    return token;
  } catch (error) {
    throw new Error(error.message);
  }
}

/**
 * check for token validity and expiry date
 * @param {Object} oauth2Client - an instance of the OAuth 2.0 client library
 * @param {string} accessToken - access token
 * @returns {boolean} - true if token is valid and not expired, false otherwise
 */
async function checkTokenValidity(accessToken) {
  try {
    const oauth2Client = getOAuthClient();
    const tokenInfo = await oauth2Client.getTokenInfo(accessToken);
    const now = new Date().getTime() / 1000;
    if (tokenInfo.expires_at <= now) {
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Generates an XOAuth2 token for the user to authenticate with the IMAP server.
 * @param {object} authData - An object containing the token, refresh token, and email of the user account.
 * @returns {Promise<object>} An object containing the XOAuth2 token and the new token.
 */
async function generateXOauthToken({ token, refreshToken, email }) {
  let accessToken = token;

  if (!await checkTokenValidity(token)) {
    accessToken = await refreshAccessToken(refreshToken);
  }

  const xoauth2gen = xoauth2.createXOAuth2Generator({
    user: email,
    clientId: googleClientId,
    clientSecret: googleClientSecret,
    accessToken
  });

  const authData = `user=${email}\x01auth=Bearer ${xoauth2gen.accessToken}\x01\x01`;
  const xoauth2_token = new Buffer.from(authData, 'utf-8').toString('base64');

  return { xoauth2Token: xoauth2_token, newToken: accessToken };
}

module.exports = {
  generateXOauthToken
};
