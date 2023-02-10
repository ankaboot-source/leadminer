/* istanbul ignore file */
const { OAuth2Client } = require('google-auth-library');
const { GOOGLE_CLIENT_ID, GOOGLE_SECRET } = require('../config');

const { db } = require('../db');

// returns Oauth client
function getOAuthClient() {
  return new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_SECRET, 'postmessage');
}

/**
 * Uses the authorization code to retrieve tokens
 * then create a record in the database if valid user infos
 * @param  {} req
 * @param  {} res
 */
exports.signUpWithGoogle = async (req, res, next) => {
  const { authCode } = req.body;

  if (!authCode) {
    res.status(400);
    return next(
      new Error('An authorization code is required to signup with Google.')
    );
  }

  performance.mark('google-login-start');

  const oAuth2Client = getOAuthClient();

  try {
    const { tokens } = await oAuth2Client.getToken(authCode);
    const { access_token, refresh_token } = tokens;

    oAuth2Client.setCredentials({
      access_token
    });

    const { exp, email } = await oAuth2Client.getTokenInfo(access_token);
    const dbGoogleUser =
      (await db.getGoogleUserByEmail(email)) ??
      (await db.createGoogleUser({ email, refresh_token }));

    if (!dbGoogleUser) {
      throw Error('Failed to create or query googleUser');
    }

    if (dbGoogleUser.refresh_token !== refresh_token) {
      await db.updateGoogleUser(dbGoogleUser.id, refresh_token);
    }

    return res.status(200).send({
      googleUser: {
        email: dbGoogleUser.email,
        id: dbGoogleUser.id,
        access_token,
        token: {
          access_token,
          expiration: exp
        }
      }
    });
  } catch (error) {
    return next({
      message: 'Error when sign up with google',
      details: error.message
    });
  }
};
