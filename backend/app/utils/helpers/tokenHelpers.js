/* istanbul ignore file */
const xoauth2 = require('xoauth2');
const { OAuth2Client } = require('google-auth-library');
const {
  googleClientId,
  googleClientSecret
} = require('../../config/google.config');
const RedirectionUrl = 'postmessage';

function getOAuthClient() {
  return new OAuth2Client(googleClientId, googleClientSecret, RedirectionUrl);
}
/**
 * Uses the refreshToken to refresh an expired accessToken
 * @param {string} refreshToken - Stored token
 * @param {string} expirationDate - Expiration date of the token
 *  @returns {Promise<object>}
 */
async function refreshAccessToken(refreshToken, expirationDate) {
  const oauth2Client = getOAuthClient();

  oauth2Client.setCredentials({
    refreshToken
  });

  try {
    const token = await oauth2Client.getAccessToken();
    return {
      access_token: token,
      expiration: Math.floor(expirationDate / 1000)
    };
  } catch (error) {
    throw new Error(error);
  }
}

/**
 * Generates an XOAuth2 token for the user to authenticate with the IMAP server.
 * @param {object} user - The user account data we're authenticating to.
 * @returns {Promise<object>} An object with two properties: xoauth2Token and newToken.
 */
async function generateXOauthToken({ token, refreshToken, email }) {
  let accessToken = token;

  const oauth2Client = getOAuthClient();
  const { expiry_date } = await oauth2Client.getTokenInfo(accessToken);

  if (Number(token.expiration) + 8 > Math.floor(expiry_date / 1000)) {
    accessToken = await refreshAccessToken(refreshToken, expiry_date);
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
