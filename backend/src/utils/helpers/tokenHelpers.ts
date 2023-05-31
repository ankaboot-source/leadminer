import { Client, TokenSet } from 'openid-client';
// @ts-ignore - until we add the module to types
import { createXOAuth2Generator } from 'xoauth2';
import ENV from '../../config';

/**
 * Generates an XOAuth2 token for the user to authenticate with the IMAP server.
 * @param oauthClient - The OAuth strategy object to be used for retrieving/refreshing tokens.
 * @param accessToken - The current user access token.
 * @param refreshToken - The user's refresh token, used to refresh the access token when it expires.
 * @param email - The email address of the user.
 * @returns An object containing the XOAuth2 token and the new access token.
 */
export default async function generateXOauthToken(
  oauthClient: Client,
  accessToken: string,
  refreshToken: string,
  email: string
): Promise<{ xoauth2Token: string; newToken: string }> {
  let validated = {};

  try {
    validated = await oauthClient.userinfo(accessToken);
  } catch (err) {
    validated = false;
  }
  const tokenSet: TokenSet | string = validated
    ? await oauthClient.refresh(refreshToken)
    : accessToken;
  const xoauth2gen = createXOAuth2Generator({
    user: email,
    clientId: ENV.GOOGLE_CLIENT_ID,
    clientSecret: ENV.GOOGLE_SECRET,
    accessToken: typeof tokenSet === 'string' ? tokenSet : tokenSet.access_token
  });

  const authData = `user=${email}\x01auth=Bearer ${xoauth2gen.accessToken}\x01\x01`;
  const xoauth2Token = Buffer.from(authData, 'utf-8').toString('base64');
  return { xoauth2Token, newToken: xoauth2gen.accessToken };
}
