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
 * Uses the refresh_token to refresh the expired access_token
 * @param  {} refresh_token stored token
 */
function refreshAccessToken(refresh_token, tokenInfo) {
  return new Promise((resolve) => {
    // return OAuth2 client
    const oauth2Client = getOAuthClient();

    oauth2Client.setCredentials({
      refresh_token
    });
    oauth2Client.getAccessToken().then((_, token) => {
      if (token) {
        const access_token = {
          access_token: token,
          expiration: Math.floor(tokenInfo.expiry_date / 1000)
        };
        resolve(access_token);
      }
    });
    // if (err) {
    //   console.log(err, token);
    //   reject("can't retrieve token");
    // }
  });
}
/**
 * generateXOauthToken generates an XOAuth2 token for the user to authenticate with the IMAP server
 * @param user - The user account data we're authenticating to.
 * @returns An object with two properties: xoauth2Token and newToken.
 */
async function generateXOauthToken(user) {
  let access_Token = user.token;
  // const now = new Date();
  // const utc_timestamp = Date.UTC(
  //   now.getUTCFullYear(),
  //   now.getUTCMonth(),
  //   now.getUTCDate(),
  //   now.getUTCHours(),
  //   now.getUTCMinutes(),
  //   now.getUTCSeconds()
  // );
  // if access_token is expired then refresh it using refresh_token

  const oauth2Client = getOAuthClient();

  const tokenInfo = await oauth2Client.getTokenInfo(access_Token);
  if (
    Number(user.token.expiration) + 8 >
    Math.floor(tokenInfo.expiry_date / 1000)
  ) {
    access_Token = await refreshAccessToken(user.refreshToken, tokenInfo);
  }
  // create xoauth2 token
  const xoauth2gen = xoauth2.createXOAuth2Generator({
      user: user.email,
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      accessToken: access_Token
    }),
    authData = `user=${user.email}\x01auth=Bearer ${xoauth2gen.accessToken}\x01\x01`,
    xoauth2_token = new Buffer.from(authData, 'utf-8').toString('base64');
  return { xoauth2Token: xoauth2_token, newToken: access_Token };
}
exports.generateXOauthToken = generateXOauthToken;
