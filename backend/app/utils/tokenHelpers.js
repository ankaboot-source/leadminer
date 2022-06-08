const xoauth2 = require("xoauth2");
const googleController = require("../controllers/google.controller");
/**
 * Genearate xoauth token string using access token and userinfo
 * @param  {} token current access_token
 * @param  {} userInfo user infos(email, id..)
 * @param  {} userRefreshToken refresh_token
 * @returns xoauthtoken: xoauth token string, access_token: real access_token
 */
async function generateXOauthToken(token, userInfo, userRefreshToken) {
  let access_Token = token;
  let now = new Date();
  let utc_timestamp = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds()
  );
  // if access_token is expired then refresh it using refresh_token
  if (Number(token.experation) + 8 < Math.floor(utc_timestamp / 1000)) {
    access_Token = await googleController.refreshAccessToken(userRefreshToken);
  }
  const xoauth2gen = xoauth2.createXOAuth2Generator({
    user: userInfo.email,
    clientId: process.env.GG_CLIENT_ID,
    clientSecret: process.env.GG_CLIENT_SECRET,
    accessToken: access_Token.access_token,
  });
  const authData = `user=${userInfo.email}\x01auth=Bearer ${xoauth2gen.accessToken}\x01\x01`;
  const xoauth2_token = new Buffer.from(authData, "utf-8").toString("base64");
  return { xoauth2Token: xoauth2_token, newToken: access_Token };
}
exports.generateXOauthToken = generateXOauthToken;
