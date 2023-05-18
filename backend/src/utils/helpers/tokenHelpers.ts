import { Client, TokenSet } from 'openid-client';
import { createXOAuth2Generator } from 'xoauth2';
import { GOOGLE_CLIENT_ID, GOOGLE_SECRET } from '../../config';

/**
 * Validates an access token using a custom verification function.
 * @param {CallableFunction} verify - The custom verification function for validating the token.
 * @param {string} token - The access token to validate.
 * @returns {Promise<boolean>} - A promise that resolves to a boolean indicating whether the token is valid.
 */
async function validateToken(
  verify: CallableFunction,
  token: string
): Promise<boolean> {
  try {
    await verify(token);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Refreshes the access token using a refresh token and an OAuth strategy.
 *
 * @param {Client} client - The OAuth client to use for refreshing the access token.
 * @param {string} refreshToken - The refresh token to use for requesting new tokens.
 * @returns {Promise<TokenSet>} - A promise that resolves to an object containing the new access token and refresh token.
 * @throws {Error} - If the token refresh fails.
 */
async function refreshAccessToken(
  client: Client,
  refreshToken: string
): Promise<TokenSet> {
  return client.refresh(refreshToken);
}

/**
 * Generates an XOAuth2 token for the user to authenticate with the IMAP server.
 * @param {Client} oauthClient - The OAuth strategy object to be used for retrieving/refreshing tokens.
 * @param {string} accessToken - The current user access token.
 * @param {string} refreshToken - The user's refresh token, used to refresh the access token when it expires.
 * @param {string} email - The email address of the user.
 * @returns {Promise<{ xoauth2Token: string; newToken: string }>} - An object containing the XOAuth2 token and the new access token.
 */
export default async function generateXOauthToken(
  oauthClient: Client,
  accessToken: string,
  refreshToken: string,
  email: string
): Promise<{ xoauth2Token: string; newToken: string }> {
  const tokenSet = (await validateToken(oauthClient.userinfo, accessToken))
    ? accessToken
    : await refreshAccessToken(oauthClient, refreshToken);

  const xoauth2gen = createXOAuth2Generator({
    user: email,
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_SECRET,
    accessToken: typeof tokenSet === 'string' ? tokenSet : tokenSet.access_token
  });

  const authData = `user=${email}\x01auth=Bearer ${xoauth2gen.accessToken}\x01\x01`;
  const xoauth2Token = Buffer.from(authData, 'utf-8').toString('base64');
  return { xoauth2Token, newToken: xoauth2gen.accessToken };
}
