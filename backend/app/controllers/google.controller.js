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
exports.SignUpWithGoogle = (req, res) => {
  const oauth2Client = getOAuthClient();
  // the query param authorization code
  let code = '';

  if (req.body.authCode) {
    code = req.body.authCode;
  } else {
    res.status(400).send({
      error: 'No valid authorization code !'
    });
    return;
  }
  // use authCode to retrieve tokens
  oauth2Client.getToken(code, async (err, tokens) => {
    if (tokens) {
      const googleUser = {};
      // oauthclient to use the access_token

      oauth2Client.setCredentials({
        access_token: tokens.access_token
      });
      const tokenInfo = await oauth2Client.getTokenInfo(tokens.access_token);
      googleUser.email = tokenInfo.email;

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
      res.status(400).send({
        error: `Can't authenticate using google account, reason : ${err}`
      });
    }
  });
};
