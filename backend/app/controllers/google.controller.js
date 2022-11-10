/* istanbul ignore file */
const { OAuth2Client } = require('google-auth-library');
const googleUsers = require('../models').googleUsers;
const logger = require('../utils/logger')(module);
const {
  googleClientId,
  googleClientSecret
} = require('../config/google.config');
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
exports.signUpWithGoogle = (req, res) => {
  if (!req.body?.authCode) {
    res.status(400).send({
      error: 'No valid authorization code !'
    });
    return;
  }

  const oAuth2Client = getOAuthClient();

  oAuth2Client.getToken(req.body.authCode, async (err, tokens) => {
    if (err || !tokens) {
      Promise.resolve(
        res.status(400).send({
          error: `Can't authenticate using google account, reason : ${err}`
        })
      );
    }

    oAuth2Client.setCredentials({
      access_token: tokens.access_token
    });

    const tokenInfo = await oAuth2Client.getTokenInfo(tokens.access_token);

    const googleUser = {
      email: tokenInfo.email,
      refreshToken: tokens.refresh_token
    };

    const dbGoogleUser = await googleUsers.findOne({
      where: { email: googleUser.email }
    });

    if (!dbGoogleUser) {
      const newGoogleUser = await googleUsers
        .create(googleUser)
        .catch((googleUserCreationError) => {
          logger.error('Unable to create account for user.', {
            error: googleUserCreationError
          });
          res.status(500).send({
            error: 'An error has occurred while creating your account.'
          });
        });

      res.status(200).send({
        googleUser: {
          email: newGoogleUser.google_users.dataValues.email,
          id: newGoogleUser.google_users.dataValues.id,
          token: {
            access_token: tokens.access_token,
            expiration: tokenInfo.exp
          }
        }
      });
    } else if (dbGoogleUser.refreshToken !== googleUser.refreshToken) {
      await googleUsers.update(
        { refreshToken: dbGoogleUser.dataValues.refreshToken },
        { where: { id: dbGoogleUser.dataValues.id } }
      );

      logger.info('On signUp With Google : Account already exists.', {
        googleUserId: googleUser.id
      });

      res.status(200).send({
        message: 'Your account already exists !',
        googleUser: {
          email: dbGoogleUser.email,
          id: dbGoogleUser.id,
          access_token: tokens.access_token,
          token: {
            access_token: tokens.access_token,
            expiration: tokenInfo.exp
          }
        }
      });
    }
  });
};

/**
 * Uses the refresh_token to refresh the expired access_token
 * @param  {} refresh_token stored token
 */
function refreshAccessToken(refresh_token) {
  logger.debug('refreshing user token');
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
