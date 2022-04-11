/* eslint-disable */
const regex = new RegExp(
  /((?<name>[\p{L}\p{M}.\p{L}\p{M}\d\s\(\)-]{1,})"*\s)*(<|\[)*(?<address>[A-Za-z0-9!#$%&'+\/=?^_`\{|\}~-]+(?:\.[A-Za-z0-9!#$%&'*+\/=?^_`\{|\}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)(>|\])*/imu
);
/* eslint-disable */
/* eslint-disable */
const regexmatch = new RegExp(
  /((?<name>[\p{L}\p{M}.\p{L}\p{M}\d\s\(\)-]{1,})"*\s)*(<|\[)*(?<address>[A-Za-z0-9!#$%&'+\/=?^_`\{|\}~-]+(?:\.[A-Za-z0-9!#$%&'*+\/=?^_`\{|\}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)(>|\])*/gimu
);
var fs = require("fs");
/* eslint-disable */
const { emailsInfos } = require("../models");
const logger = require("./logger")(module);
const { Op } = require("sequelize");
const disposable = require("./Disposable.json");
const freeProviders = require("./FreeProviders.json");
const ValidDomainsSet = require("./ValidDomains.json");
const InvalidDomainsSet = require("./InvalidDomains.json");
const dns = require("dns");
const dnsPromises = dns.promises;
/**
 * After validating/invalidating dns in CheckDOmainType() we can store valid domains for a next use.
 * @param  {} emails Clean emails
 */

function checkExistence(database, email) {
  return database.some((element) => {
    return element.email.address === email.address;
  });
}
function checkForNoReply(oneEmail, imapEmail) {
  if (
    !oneEmail.address.includes(imapEmail) &&
    !oneEmail.address.includes("noreply") &&
    !oneEmail.address.includes("no-reply") &&
    !oneEmail.address.includes("notifications-noreply") &&
    !oneEmail.address.includes("accusereception") &&
    !oneEmail.address.includes("support") &&
    !oneEmail.address.includes("maildaemon") &&
    !oneEmail.address.includes("notifications")
  ) {
    return true;
  } else {
    return false;
  }
}
function addEmailToDatabase(database, email) {
  database.push(email);
}

function addFieldsAndFolder(database, email) {
  let done = false;
  database.map((element) => {
    if (email.email.address == element.email.address) {
      for (var i = 0; i < element.field.length; i++) {
        if (element.field[i][0] == email.field[0][0]) {
          element.field[i][1] += 1;
          done = true;
          break;
        }
      }
      if (!done) {
        element.field.push(email.field[0]);
      }
    }
  });
}
function addEmailType(EmailInfo) {
  console.log(EmailInfo);
  let domain = EmailInfo.email.address.split("@")[1];
  if (disposable.includes(domain)) {
    EmailInfo["type"] = "Disposable";
  } else if (freeProviders.includes(domain)) {
    EmailInfo["type"] = "Free domain";
  } else {
    EmailInfo["type"] = "Private domain";
  }
}
exports.checkExistence = checkExistence;
exports.addEmailToDatabase = addEmailToDatabase;
exports.addFieldsAndFolder = addFieldsAndFolder;
exports.checkForNoReply = checkForNoReply;
exports.addEmailType = addEmailType;
