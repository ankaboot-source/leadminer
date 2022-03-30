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
exports.checkExistence = checkExistence;
exports.addEmailToDatabase = addEmailToDatabase;
exports.addFieldsAndFolder = addFieldsAndFolder;
