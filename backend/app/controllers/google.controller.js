/* istanbul ignore file */
const { OAuth2Client } = require('google-auth-library');
const db = require('../models');
const config = require('config'),
  googleUsers = db.googleUsers,
  logger = require('../utils/logger')(module),
  ClientId = config.get('google_api.client.id'),
  ClientSecret = config.get('google_api.client.secret'),
  RedirectionUrl = 'postmessage';

// returns Oauth client
function getOAuthClient() {
  return new OAuth2Client(ClientId, ClientSecret, RedirectionUrl);
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

  const oauth2Client = getOAuthClient();

<<<<<<< HEAD
      googleUser.refreshToken = tokens.refresh_token;

      if (googleUser) {
        googleUsers
          .findOne({ where: { email: googleUser.email } })
          .then((google_user) => {
            if (google_user === null) {
              // Save googleUsers in the database
              googleUsers
                .create(googleUser)
                .then((data) => {
                  res.status(200).send({
                    googleUser: {
                      email: data.google_users.dataValues.email,
                      id: data.google_users.dataValues.id,
                      access_token: {
                        access_token: tokens.access_token,
                        experation: tokenInfo.exp
                      }
                    }
                  });
                })
                .catch((err) => {
                  logger.error('Unable to create use account.', { error: err });
                  res.status(500).send({
                    error: 'An error has occurred while creating your account.'
                  });
                });
            } else if (google_user) {
              googleUsers
                .update(
                  { refreshToken: googleUser?.refreshToken },
                  { where: { id: google_user.dataValues.id } }
                )
                .then(() => {
                  logger.info(
                    `On signUp With Google : Account with id: ${googleUser.id} already exists`
                  );
                  console.log(tokens, tokenInfo);
                  // case when user id exists
                  res.status(200).send({
                    message: 'Your account already exists !',
                    googleUser: {
                      email: google_user.email,
                      id: google_user.id,
                      access_token: {
                        access_token: tokens.access_token,
                        experation: tokenInfo.exp
                      }
                    }
                  });
                });
            }
          });
      }
    } else {
      // erro with authorization code
=======
  oauth2Client.getToken(req.body.authCode, async (err, tokens) => {
    if (err || !tokens) {
>>>>>>> main
      res.status(400).send({
        error: `Can't authenticate using google account, reason : ${err}`
      });
      return;
    }

    oauth2Client.setCredentials({
      access_token: tokens.access_token
    });

    // const oauth2 = googleApi.oauth2({
    //     auth: oauth2Client,
    //     version: "v2",
    //   }),
    // get user infos( email, id, photo...)
    //response = await oauth2.userinfo.get({}),

    const tokenInfo = await oauth2Client.getTokenInfo(tokens.access_token);
    logger.log(tokenInfo);

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
<<<<<<< HEAD
    oauth2Client.getAccessToken().then(async (err, token) => {
      if (token) {
        const tokenInfo = await oauth2Client.getTokenInfo(token);
        const access_token = {
          access_token: token,
          experation: Math.floor(tokenInfo.expiry_date / 1000)
        };
        resolve(access_token);
      }
    });
    // if (err) {
    //   console.log(err, token);
    //   reject("can't retrieve token");
    // }
=======
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
>>>>>>> main
  });
}

exports.refreshAccessToken = refreshAccessToken;
