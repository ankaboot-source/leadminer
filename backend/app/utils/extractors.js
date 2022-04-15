/* eslint-disable */

/* eslint-disable */
/* eslint-disable */
const regexmatch = new RegExp(
  /((?<name>[\p{L}\p{M}.\p{L}\p{M}\d\s\(\)-]{1,})"*\s)*(<|\[)*(?<address>[A-Za-z0-9!#$%&'+\/=?^_`\{|\}~-]+(?:\.[A-Za-z0-9!#$%&'*+\/=?^_`\{|\}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)(>|\])*/gimu
);
var fs = require("fs");
/* eslint-disable */
const disposable = require("./Disposable.json");
const freeProviders = require("./FreeProviders.json");
const dns = require("dns");
const utilsForRegEx = require("./regexp");
/**
 * Check if a given email address is already mined or no.
 * @param  {object} email One email address
 */

function checkExistence(database, email) {
  return database.some((element) => {
    return element.email.address === email.address;
  });
}

/**
 * Check if a given email address includes noreply strings pattern.
 * Or it's the imapEmail address.
 * @param  {object} oneEmail A email address
 * @param  {string} imapEmail Email address associated to connected imap account
 */
function checkForNoReply(oneEmail, imapEmail) {
  const NOREPLY = [
    imapEmail,
    "noreply",
    "no-reply",
    "notifications-noreply",
    "accusereception",
    "support",
    "maildaemon",
    "notifications",
  ];
  let noReply = NOREPLY.filter((word) => oneEmail.address.includes(word));
  if (noReply.length) {
    return true;
  } else {
    return false;
  }
}

/**
 * Add a given Email to data.
 * @param  {Array} database
 * @param  {object} email
 */
function addEmailToDatabase(database, email) {
  database.push(email);
  return database;
}
/**
 * Add fields and folder to a given email .
 * @param  {Array} database
 * @param  {object} email
 */
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
/**
 * Adds Email type to EmailInfo by checking against domain type database.
 * @param  {object} EmailInfo Email infos (address, name, folder, msgID..)
 */
function addEmailType(EmailInfo) {
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
/**
 * Manipulate data(emails) without checking the dns.
 * @param  {string} element field (from, cc, bcc..)
 * @param  {object} oneEmail email address and name
 * @param  {Array} database global data
 */
function manipulateData(element, oneEmail, database) {
  let isExist = checkExistence(database, oneEmail);
  let emailInfo = {
    email: oneEmail,
    field: [[element, 1]],
    folder: ["pending"],
    msgId: 0,
  };
  let EmailAfterType = addEmailType(emailInfo);
  if (!isExist) {
    return addEmailToDatabase(database, EmailAfterType);
  } else {
    return addFieldsAndFolder(database, EmailAfterType);
  }
}

/**
 * Check DNS Mx record then append email to database.
 *
 * In case of error or no Mx record it sets domain as KO fo further scans
 * @param  {} element
 * @param  {} domain
 * @param  {} oneEmail
 * @param  {} database
 * @param  {} client
 */
function manipulateDataWithDns(element, domain, oneEmail, database, client) {
  if (domain) {
    dns.resolveMx(domain, async (error, addresses) => {
      if (addresses) {
        //set domain in redis
        await client.set(domain, "ok", {
          EX: 40,
        });
        // append data when domain is valid
        return manipulateData(element, oneEmail, database);

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

/**
 * Treat parsed Emails.
 * @param  {object} dataTobeStored
 * @param  {Array} database
 * @param  {redis client} client
 */
function treatParsedEmails(dataTobeStored, database, client) {
  Object.keys(dataTobeStored).map((element) => {
    if (dataTobeStored[element][0].includes("@")) {
      let email =
        element != "body"
          ? utilsForRegEx.extractNameAndEmail(dataTobeStored[element])
          : utilsForRegEx.extractNameAndEmailForBody(dataTobeStored[element]);
      // check existence in database or data array
      email.map(async (oneEmail) => {
        if (oneEmail) {
          // domain to be used for DNS MXrecord check
          let domain = oneEmail.address.split("@")[1];
          // check if already stored in cache (used to speed up domain validation)
          let domainRedis = await client.get(domain);
          // if domain already stored in cache
          if (domainRedis) {
            return manipulateData(element, oneEmail, database);
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
}
exports.checkExistence = checkExistence;
exports.addEmailToDatabase = addEmailToDatabase;
exports.addFieldsAndFolder = addFieldsAndFolder;
exports.checkForNoReply = checkForNoReply;
exports.addEmailType = addEmailType;
exports.treatParsedEmails = treatParsedEmails;
