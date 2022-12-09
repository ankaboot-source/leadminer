/* istanbul ignore file */
const { OAuth2Client } = require('google-auth-library');

const {
  googleClientId,
  googleClientSecret
} = require('../config/google.config');
const { db } = require('../db');
const RedirectionUrl = 'postmessage';

// returns Oauth client
function getOAuthClient() {
  return new OAuth2Client(googleClientId, googleClientSecret, RedirectionUrl);
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
      await db.updateGoogleUser(dbGoogleUser.id, {
        refresh_token
      });
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

/**
 * Uses the refresh_token to refresh the expired access_token
 * @param  {} refresh_token stored token
 */
function refreshAccessToken(refresh_token) {
  return new Promise(async (resolve, reject) => {
    // return OAuth2 client
    const oauth2Client = getOAuthClient();

    oauth2Client.setCredentials({
      refresh_token
    });
    const { err, token } = await oauth2Client.getAccessToken();
    if (err) {
      reject("can't retrieve token");
    }

    const tokenInfo = await oauth2Client.getTokenInfo(token);
    const access_token = {
      access_token: token,
      expiration: Math.floor(tokenInfo.expiry_date / 1000)
    };
    resolve(access_token);
  });
}

exports.refreshAccessToken = refreshAccessToken;
