/* istanbul ignore file */
var { google } = require("googleapis");
var OAuth2 = google.auth.OAuth2;
const db = require("../models");
const googleUsers = db.googleUsers;
const logger = require("../utils/logger")(module);

const ClientId = process.env.GG_CLIENT_ID;
const ClientSecret = process.env.GG_CLIENT_SECRET;
const RedirectionUrl = "postmessage";

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
  let oauth2Client = getOAuthClient();
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
  oauth2Client.getToken(code, async function (err, tokens) {
    console.log(tokens);
    if (tokens) {
      let googleUser = {};
      // oauthclient to use the access_token
      oauth2Client.setCredentials({
        access_token: tokens.access_token,
      });
      var oauth2 = google.oauth2({
        auth: oauth2Client,
        version: "v2",
      });
      // get user infos( email, id, photo...)
      let response = await oauth2.userinfo.get({});
      let tokenInfo = await oauth2Client.getTokenInfo(tokens.access_token);
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
                .then((data) => {
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
                      "Some error occurred while creating your account your account.",
                  });
                });
            } else {
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
            }
          });
      }
    } else {
      // erro with authorization code
      res.status(400).send({
        error: `Can't authenticate using google account, reason : ${err}`,
      });
      return;
    }
  });
};
/**
 * Uses the refresh_token to refresh the expired access_token
 * @param  {} refresh_token stored token
 */
async function refreshAccessToken(refresh_token) {
  return new Promise((resolve, reject) => {
    let tokenInfo = {};
    let access_token;
    // return OAuth2 client
    function getOAuthClient() {
      return new OAuth2(ClientId, ClientSecret, RedirectionUrl);
    }
    let oauth2Client = getOAuthClient();
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
