const xoauth2 = require('xoauth2');
const googleController = require('../controllers/google.controller');

/**
 * It generates an XOAuth2 token for the user to authenticate with the IMAP server
 * @param user - The user account data you're authenticating to.
 * @returns An object with two properties: xoauth2Token and newToken.
 */
async function generateXOauthToken(user) {
  let access_Token = user.token;
  const now = new Date();
  const utc_timestamp = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds()
  );
  // if access_token is expired then refresh it using refresh_token
  if (Number(user.token.experation) + 8 < Math.floor(utc_timestamp / 1000)) {
    access_Token = await googleController.refreshAccessToken(user.refreshToken);
  }
  const xoauth2gen = xoauth2.createXOAuth2Generator({
    user: user.email,
    clientId: process.env.GG_CLIENT_ID,
    clientSecret: process.env.GG_CLIENT_SECRET,
    accessToken: access_Token.access_token,
  });
  const authData = `user=${user.email}\x01auth=Bearer ${xoauth2gen.accessToken}\x01\x01`;
  const xoauth2_token = new Buffer.from(authData, 'utf-8').toString('base64');
  return { xoauth2Token: xoauth2_token, newToken: access_Token };
}
exports.generateXOauthToken = generateXOauthToken;
