var { google } = require("googleapis");
var OAuth2 = google.auth.OAuth2;
const ClientId = process.env.GG_CLIENT_ID;
const ClientSecret = process.env.GG_CLIENT_SECRET;
const RedirectionUrl = "postmessage";
const Imap = require("imap");
const db = require("../models");
const ImapInfo = db.imapInfo;
const logger = require("../utils/logger")(module);
const UtilsForData = require("../utils/inputHelpers");
const imapService = require("../services/imapService");
const xoauth2 = require("xoauth2");
const objectScan = require("object-scan");

function getOAuthClient() {
  return new OAuth2(ClientId, ClientSecret, RedirectionUrl);
}

var oauth2Client = getOAuthClient();
oauth2Client.setCredentials({
  access_token:
    "ya29.a0ARrdaM9CFjUbFjfbEqP0-DJQ0RGS4TE6_uLR6UaoiDrvaIP3_gvfLFy4GzSS6i1YBMWXpHhIgW_n9QseHvfax_6lwnuPTI9tIYPWJE1XR8m1lJ7j2j6V2iRFe-6bneum0pT2PKloL9oxPQRdead6kfTkT2gM",
});
var oauth2 = google.oauth2({
  auth: oauth2Client,
  version: "v2",
});
oauth2.userinfo.get(function (err, res) {
  if (err) {
    console.log(err);
  } else {
    console.log(res);
  }
});
var code =
  "4/0AX4XfWivi1cRUtmnHssS3mtpcK7uXVtm8sZoMlyJX6-wcu1bXZ9DGXea-Cblu1537M6ovw"; // the query param code
oauth2Client.getToken(code, function (err, tokens) {
  // Now tokens contains an access_token and an optional refresh_token. Save them.
  console.log(err, tokens);
});

// const axios = require("axios");
// const google_access_token_endpoint = "https://oauth2.googleapis.com/token";

// const get_access_token = async (auth_code) => {
//   const access_token_params = {
//     client_secret: "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",
//     code: "4/0AX4XfWilzcW6Cqb-hWb14LIAhtCBocAGeCwqJRTSro6IbHBBKAYddgzeb6fq7efgyWfSsw",
//     grant_type: "authorization_code",
//   };
//   return await axios({
//     method: "post",
//     url: `${google_access_token_endpoint}?${access_token_params}`,
//   });
// };

// module.exports = { request_get_auth_code_url, get_access_token };
ImapInfo.findOne({ where: { email: imapInfo.email } }).then((imapdata) => {
  if (imapdata === null) {
    // Save ImapInfo in the database
    ImapInfo.create(imapInfo)
      .then((data) => {
        res.status(200).send({ imapdata: data });
      })
      .catch((err) => {
        logger.error(
          `can't create account with email ${req.body.email} : ${err}`
        );
        res.status(500).send({
          error:
            "Some error occurred while creating your account imap info.",
        });
      });
  } else {
    logger.info(
      `On signup : Account with email ${req.body.email} already exist`
    );
    res.status(200).send({
      message: "Your account already exists !",
      switch: true,
      imapdata,
    });
  }