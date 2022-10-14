/* istanbul ignore file */
const { OAuth2Client } = require("google-auth-library");
const { rejections } = require("winston");
const db = require("../models");
const config = require("config"),
  googleUsers = db.googleUsers,
  logger = require("../utils/logger")(module),
  ClientId = config.get("google_api.client.id"),
  ClientSecret = config.get("google_api.client.secret"),
  RedirectionUrl = "postmessage";

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
exports.SignUpWithGoogle = async (req, res) => {
  const oauth2Client = getOAuthClient();
  // the query param authorization code
  let code = "";

  if (req.body.authCode) {
    code = req.body.authCode;
  } else {
    res.status(400).send({
      error: "No valid authorization code !",
    });
    return;
  }
  // use authCode to retrieve tokens
  oauth2Client.getToken(code, async (err, tokens) => {
    if (tokens) {
      const googleUser = {};
      // oauthclient to use the access_token

      oauth2Client.setCredentials({
        access_token: tokens.access_token,
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
                      "Some error occurred while creating your account your account.",
                  });
                });
            } else if (
              google_user &&
              google_user.refreshToken !== googleUser.refreshToken
            ) {
              googleUsers
                .update(
                  { refreshToken: google_user.dataValues.refreshToken },
                  { where: { id: google_user.dataValues.id } }
                )
                .then(() => {
                  logger.info(
                    `On signUp With Google : Account with id: ${googleUser.id} already exist`
                  );
                  // case when user id exists
                  res.status(200).send({
                    message: "Your account already exists !",
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
function refreshAccessToken(refresh_token) {
  return new Promise(async (resolve, reject) => {
    logger.debug("refreshing user token");

    // return OAuth2 client

    const oauth2Client = getOAuthClient();

    oauth2Client.setCredentials({
      refresh_token: refresh_token,
    });
    const { err, token } = await oauth2Client.getAccessToken();
    if (err) {
      reject("can't retrieve token");
    }

    let tokenInfo = await oauth2Client.getTokenInfo(token);
    let access_token = {
      access_token: token,
      experation: Math.floor(tokenInfo.expiry_date / 1000),
    };
    resolve(access_token);
  });
}

exports.refreshAccessToken = refreshAccessToken;
