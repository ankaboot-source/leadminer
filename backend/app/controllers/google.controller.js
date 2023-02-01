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

  const oAuth2Client = getOAuthClient();

  try {
    const { tokens } = await oAuth2Client.getToken(authCode);
    const { access_token, refresh_token } = tokens;

    oAuth2Client.setCredentials({
      access_token
    });
    const { exp, email } = await oAuth2Client.getTokenInfo(access_token);

    const dbGoogleUser = await db.getGoogleUserByEmail(email);

    if (!dbGoogleUser) {
      const { id } = await db.createGoogleUser({
        email,
        refresh_token
      });

      return res.status(200).send({
        googleUser: {
          email,
          id,
          access_token,
          token: {
            access_token,
            expiration: exp
          }
        }
      });
    }

    if (dbGoogleUser.refresh_token !== refresh_token) {
      await db.updateGoogleUser(dbGoogleUser.id, refresh_token);
    }

    return res.status(200).send({
      message: 'Your account already exists !',
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
    error.message = 'Failed to signup with Google.';
    return next(error);
  }
};
