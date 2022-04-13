/* eslint-disable */

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
const utilsForRegEx = require("./regexp");

/**
 * After validating/invalidating dns in CheckDOmainType() we can store valid domains for a next use.
 * @param  {} emails Clean emails
 */

function checkExistence(database, email) {
  //console.log(database, email);
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
  return database;
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
  return database;
}
function addEmailType(EmailInfo) {
  //console.log(EmailInfo);
  let domain = EmailInfo.email.address.split("@")[1];
  if (disposable.includes(domain)) {
    EmailInfo["type"] = "Disposable";
  } else if (freeProviders.includes(domain)) {
    EmailInfo["type"] = "Free domain";
  } else {
    EmailInfo["type"] = "Private domain";
  }
  return EmailInfo;
}
function manipulateDataWithoutDns(element, oneEmail, database) {
  //console.log(database);
  let isExist = checkExistence(database, oneEmail);
  let emailInfo = {
    email: oneEmail,
    field: [[element, 1]],
    folder: ["pending"],
    msgId: 0,
  };
  let EmailAfterType = addEmailType(emailInfo);
  if (!isExist) {
    //console.log(database, "after");

    return addEmailToDatabase(database, EmailAfterType);
    //console.log(database, "after");
  } else {
    return addFieldsAndFolder(database, EmailAfterType);
  }

  //sse.send(database, "data");
}
function manipulateDataWithDns(element, domain, oneEmail, database, client) {
  if (domain) {
    dns.resolveMx(domain, async (error, addresses) => {
      if (addresses) {
        //console.log(addresses);
        await client.set(domain, "ok", {
          EX: 40,
        });
        // append data when domain is valid
        return manipulateDataWithoutDns(element, oneEmail, database);

        // if (sends.includes(seqno)) {
        //   sse.send(database, "data");
        // }
        // if (
        //   currentbox.name == boxes[boxes.length - 1] &&
        //   seqno + 10 > currentbox.messages.total
        // ) {
        //   console.log("yes");
        //sse.send(false, "dns");
        // }
        //console.log("helo val");
      } else {
        await client.set(domain, "ko", {
          EX: 40,
        });
      }
    });
  }
}
function treatParsedEmails(dataTobeStored, database, client) {
  Object.keys(dataTobeStored).map((element) => {
    // regexp
    if (dataTobeStored[element][0].includes("@")) {
      let email =
        element != "body"
          ? utilsForRegEx.extractNameAndEmail(dataTobeStored[element])
          : utilsForRegEx.extractNameAndEmailForBody(dataTobeStored[element]);
      // check existence in database or data array
      email.map(async (oneEmail) => {
        //console.log(oneEmail);
        if (oneEmail) {
          // domain to be used for DNS MXrecord check
          let domain = oneEmail.address.split("@")[1];
          // check if already stored in cache (used to speed up domain validation)
          let domainRedis = await client.get(domain);
          // add domain to
          // if (!domainRedis) {
          //   await client.set(domain, domain, {
          //     EX: 200,
          //   });
          // }
          // if already stored stored in cache
          if (domainRedis) {
            // manipulate data,(case: domain already stored)
            return manipulateDataWithoutDns(element, oneEmail, database);

            //console.log(database);
            // if (sends.includes(seqno)) {
            //   sse.send(database, "data");
            // }
            // if (
            //   currentbox.name == boxes[boxes.length - 1] &&
            //   seqno + 10 > currentbox.messages.total
            // ) {
            //   console.log("yes");
            //   sse.send(false, "dns");
            // }
          } else {
            return manipulateDataWithDns(
              element,
              domain,
              oneEmail,
              database,
              client
            );
          }
        }
      });
    }
  });
  return database;
}
exports.checkExistence = checkExistence;
exports.addEmailToDatabase = addEmailToDatabase;
exports.addFieldsAndFolder = addFieldsAndFolder;
exports.checkForNoReply = checkForNoReply;
exports.addEmailType = addEmailType;
exports.treatParsedEmails = treatParsedEmails;
