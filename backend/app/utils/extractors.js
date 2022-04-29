/* eslint-disable */
const disposable = require("./Disposable.json");
const freeProviders = require("./FreeProviders.json");
const dns = require("dns");
const utilsForRegEx = require("./regexpUtils");
const NOREPLY = [
  "noreply",
  "no-reply",
  "notifications-noreply",
  "accusereception",
  "support",
  "maildaemon",
  "notifications",
  "notification",
  "send-as-noreply",
  "systemalert",
  "mailer-daemon",
  "mail daemon",
  "mailer daemon",
  "alerts",
  "auto-confirm",
  "ne-pas-repondre",
  "do-not-reply",
  "FeedbackForm",
  "mailermasters",
  "wordpress",
  "notify",
  "password",
  "reply",
  "no_reply",
];
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
function IsNotNoReply(oneEmail, imapEmail) {
  let noReply = NOREPLY.filter((word) =>
    oneEmail.toLowerCase().includes(word.toLowerCase())
  );
  if (noReply.length > 0 || oneEmail.includes(imapEmail)) {
    return false;
  } else {
    return true;
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
  database.map((element) => {
    if (email.email.address == element.email.address) {
      Object.keys(element.field).includes(Object.keys(email.field)[0])
        ? (element.field[Object.keys(email.field)[0]] += 1)
        : (element.field[Object.keys(email.field)[0]] = 1);
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
    EmailInfo["type"] = "Disposable email";
  } else if (freeProviders.includes(domain)) {
    EmailInfo["type"] = "Email provider";
  } else {
    EmailInfo["type"] = " Custom domain";
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
    field: { [element]: 1 },
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
function manipulateDataWithDns(
  element,
  domain,
  oneEmail,
  database,
  client,
  timer,
  tempValidDomain
) {
  if (domain && !tempValidDomain.includes(domain)) {
    timer.time += 50;
    dns.resolveMx(domain, async (error, addresses) => {
      if (addresses) {
        timer.dnsCount += 1;
        if (!tempValidDomain.includes(domain)) {
          tempValidDomain.push(domain);
          //set domain in redis
          await client.set(domain, "ok", {
            EX: 864000,
          });
        }
        // append data when domain is valid
        return manipulateData(element, oneEmail, database);
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
function treatParsedEmails(
  sse,
  dataTobeStored,
  database,
  client,
  imapEmail,
  timer,
  tempValidDomain
) {
  Object.keys(dataTobeStored).map((element) => {
    if (true) {
      let email =
        element != "body"
          ? utilsForRegEx.extractNameAndEmail(
              dataTobeStored[element],
              imapEmail
            )
          : utilsForRegEx.FormatBodyEmail(dataTobeStored[element], imapEmail);
      // check existence in database or data array
      email.map(async (oneEmail) => {
        if (oneEmail && IsNotNoReply(oneEmail.address, imapEmail)) {
          // domain to be used for DNS MXrecord check
          let domain = oneEmail.address.split("@")[1];
          // check if already stored in cache (used to speed up domain validation)
          let domainRedis = await client.get(domain);
          // if domain already stored in cache
          if (domainRedis || tempValidDomain.includes(domain)) {
            return manipulateData(element, oneEmail, database);
          } else {
            return manipulateDataWithDns(
              element,
              domain,
              oneEmail,
              database,
              client,
              timer,
              tempValidDomain
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
exports.IsNotNoReply = IsNotNoReply;
exports.addEmailType = addEmailType;
exports.treatParsedEmails = treatParsedEmails;
