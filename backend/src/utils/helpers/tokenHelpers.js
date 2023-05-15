import { OAuth2Client } from 'google-auth-library';
import { createXOAuth2Generator } from 'xoauth2';
import { GOOGLE_CLIENT_ID, GOOGLE_SECRET } from '../../config';

function getOAuthClient() {
  return new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_SECRET, 'postmessage');
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
    return token;
  } catch (error) {
    throw new Error(
      `An error occurred while refreshing the access token: ${error.message}`
    );
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
    return tokenInfo.exp > now;
  } catch (err) {
    return false;
  }
}

/**
 * Generates an XOAuth2 token for the user to authenticate with the IMAP server.
 * @param {object} authData - An object containing the token, refresh token, and email of the user account.
 * @param {string} authData.token - The current user access token.
 * @param {string} authData.refreshToken - The user refresh token, used to refresh the access token when it expires.
 * @param {string} authData.email - The email address of the user.
 * @returns {Promise<object>} An object containing the XOAuth2 token and the new token.
 */
export default async function generateXOauthToken({
  token,
  refreshToken,
  email
}) {
  const tokenValidity = await checkTokenValidity(token);
  const accessToken = tokenValidity
    ? token
    : await refreshAccessToken(refreshToken);
  const xoauth2gen = createXOAuth2Generator({
    user: email,
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_SECRET,
    accessToken
  });
  const authData = `user=${email}\x01auth=Bearer ${xoauth2gen.accessToken}\x01\x01`;
  const xoauth2Token = Buffer.from(authData, 'utf-8').toString('base64');
  return { xoauth2Token, newToken: accessToken };
}
