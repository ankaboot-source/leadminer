/* istanbul ignore file */
const OAuth2 = require('googleapis').google.auth.OAuth2;
const db = require('../models');
const config = require('config');
const googleUsers = db.googleUsers;
const logger = require('../utils/logger')(module);
const ClientId = config.get('google_api.client.id');
const ClientSecret = config.get('google_api.client.secret');
const RedirectionUrl = 'postmessage';

// returns Oauth client
function getOAuthClient() {
  return new OAuth2(ClientId, ClientSecret, RedirectionUrl);
}
/**
 * Uses the authorization code to retrieve tokens
 * then create a record in the database if valid user infos
 * @param  {} req
 * @param  {} res
 */
exports.SignUpWithGoogle = async (req, res) => {
  const oauth2Client = getOAuthClient();
  // the query param authorization code
  let code = '';
  if (req.body.authCode) {
    code = req.body.authCode;
  } else {
    res.status(400).send({
      error: 'No valid authorization code !',
    });
    return;
  }
  // use authCode to retrieve tokens
  oauth2Client.getToken(code, async function (err, tokens) {
    if (tokens) {
      const googleUser = {};
      // oauthclient to use the access_token
      oauth2Client.setCredentials({
        access_token: tokens.access_token,
      });
      const oauth2 = require('googleapis').google.oauth2({
        auth: oauth2Client,
        version: 'v2',
      });
      // get user infos( email, id, photo...)
      const response = await oauth2.userinfo.get({});
      const tokenInfo = await oauth2Client.getTokenInfo(tokens.access_token);
      googleUser.email = response.data.email;
      googleUser.id = response.data.id;
      googleUser.refreshToken = tokens.refresh_token;

      if (googleUser.id) {
        googleUsers
          .findOne({ where: { id: googleUser.id } })
          .then((google_user) => {
            if (google_user === null) {
              // Save googleUsers in the database
              googleUsers
                .create(googleUser)
                .then(() => {
                  res.status(200).send({
                    googleUser: {
                      email: googleUser.email,
                      id: googleUser.id,
                      access_token: {
                        access_token: tokens.access_token,
                        experation: tokenInfo.exp,
                      },
                    },
                  });
                })
                .catch((err) => {
                  logger.error(
                    `can't create account with for user Error : ${err}`
                  );
                  res.status(500).send({
                    error:
                      'Some error occurred while creating your account your account.',
                  });
                });
            } else if (
              google_user &&
              google_user.refreshToken !== googleUser.refreshToken
            ) {
              googleUsers
                .update(
                  { refreshToken: googleUser.refreshToken },
                  { where: { id: googleUser.id } }
                )
                .then(() => {
                  logger.info(
                    `On signUp With Google : Account with id: ${googleUser.id} already exist`
                  );
                  // case when user id exists
                  res.status(200).send({
                    message: 'Your account already exists !',
                    googleUser: {
                      email: google_user.email,
                      id: google_user.id,
                      access_token: {
                        access_token: tokens.access_token,
                        experation: tokenInfo.exp,
                      },
                    },
                  });
                });
            }
          });
      }
    } else {
      // erro with authorization code
      res.status(400).send({
        error: `Can't authenticate using google account, reason : ${err}`,
      });
    }
  });
};
/**
 * Uses the refresh_token to refresh the expired access_token
 * @param  {} refresh_token stored token
 */
async function refreshAccessToken(refresh_token) {
  logger.debug('refreshing user token');
  return new Promise((resolve, reject) => {
    let tokenInfo = {};
    let access_token;
    // return OAuth2 client
    function getOAuthClient() {
      return new OAuth2(ClientId, ClientSecret, RedirectionUrl);
    }
    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials({
      refresh_token: refresh_token,
    });
    return oauth2Client.getAccessToken(async (err, token) => {
      tokenInfo = await oauth2Client.getTokenInfo(token);
      access_token = {
        access_token: token,
        experation: Math.floor(tokenInfo.expiry_date / 1000),
      };
      resolve(access_token);
    });
  });
}

exports.refreshAccessToken = refreshAccessToken;
