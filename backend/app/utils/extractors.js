/* istanbul ignore else */
const disposable = require("./Disposable.json");
const freeProviders = require("./FreeProviders.json");
const dns = require("dns");
const utilsForRegEx = require("./regexpUtils");
const logger = require("../utils/logger")(module);
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
  "pasdereponse",
  "mailer-daemon",
  "mail daemon",
  "mailer daemon",
  "alerts",
  "auto-confirm",
  "ne-pas-repondre",
  "nepasrepondre",
  "do-not-reply",
  "FeedbackForm",
  "mailermasters",
  "wordpress",
  "notify",
  "password",
  "reply-",
  "no_reply",
  "unsubscribe",
];
/**
 * Check if a given email address is already mined.
 * @param  {object} email One email address
 * @returns {boolean}
 */

function checkExistence(database, email) {
  return database.some((element) => {
    return element.email.address === email.address;
  });
}

/**
 * Check if a given email address includes noreply strings pattern.
 * Or it's the imapEmail address.
 * @param  {object} oneEmail A email object
 * @param  {string} imapEmail Email address associated to connected imap account
 * @returns {boolean}
 */
function IsNotNoReply(oneEmail, imapEmail) {
  const noReply = NOREPLY.filter((word) =>
    oneEmail.toLowerCase().includes(word.toLowerCase())
  );
  if (noReply.length > 0 || oneEmail.includes(imapEmail)) {
    return false;
  } else {
    return true;
  }
}

/**
 * Add a given Email to mineddata.
 * @param  {Array} database An array that represents a virtual database
 * @param  {object} email A email object
 * @returns {Array}
 */
function addEmailToDatabase(database, email) {
  if (!checkExistence(database, email.email)) {
    database.push(email);
  }
}
/**
 * Format and check if valid time zone of a given date
 * @param  {object} date Date to be formatted
 * @example
 * input : Wed, 11 May 2022 16:54:37 +0100
 * output : Wednesday, May 11th, 2022 at 14:54:37 PM (in utc time)
 * @returns {object} Formated date
 */
function parseDate(date) {
  //let timezoneOffset = date.split(" ").pop();
  const tempDate = date
    .replaceAll(/ CEST-(.*)| CEST/g, "+0200")
    .replace(/ UTC-(.*)/i, "");
  const dateFromString = new Date(tempDate);
  if (isNaN(Date.parse(dateFromString)) == false) {
    const ISODate = dateFromString.toISOString();
    return `${ISODate.substring(0, 10)} ${ISODate.substring(11, 16)}`;
  }
}

/**
 * Compare two dates
 * @param  {object} date1 First date
 * @param  {object} date2 Second date
 * @returns {object} true if date1 is greater than date2, else false
 */
function compareDates(date1, date2) {
  const d1 = Date.parse(date1);
  const d2 = Date.parse(date2);

  return d1 > d2;
}
/**
 * Add fields and folder to a given email .
 * @param  {Array} database An array that represents a virtual database
 * @param  {object} email A email object
 * @returns {Array}
 */
function addFieldsAndFolder(database, email) {
  for (const i in database) {
    if (email.email.address == database[i].email.address) {
      Object.keys(database[i].field).includes(Object.keys(email.field)[0])
        ? (database[i].field[Object.keys(email.field)[0]] += 1)
        : (database[i].field[Object.keys(email.field)[0]] = 1);
      if (compareDates(email.date, database[i].date)) {
        database[i].date = email.date;
      }
    }
  }
}
/**
 * Adds Email type to EmailInfo by checking against domain type database.
 * @param  {object} EmailInfo Email infos (address, name, folder, msgID..)
 * @returns {object} The input with a new appended field called "type"
 */
function addEmailType(EmailInfo) {
  const domain = EmailInfo.email.address.split("@")[1];
  if (disposable.includes(domain)) {
    EmailInfo["type"] = "Disposable email";
  } else if (freeProviders.includes(domain)) {
    EmailInfo["type"] = "Email provider";
  } else {
    EmailInfo["type"] = "Custom domain";
  }

  return EmailInfo;
}

/**
 * Manipulate data(emails) without checking the dns.
 * @param  {string} element Field (from, cc, bcc..)
 * @param  {object} oneEmail Email address and name
 * @param  {Array} database An array that represents a virtual database
 */
function manipulateData(element, oneEmail, database, folder, messageDate) {
  const emailInfo = {
    email: oneEmail,
    field: { [element]: 1 },
    date: parseDate(messageDate),
  };
  if (!checkExistence(database, oneEmail)) {
    addEmailToDatabase(database, addEmailType(emailInfo));
  } else {
    addFieldsAndFolder(database, emailInfo);
  }
}

/**
 * Check DNS Mx record then append email to database
 * In case of error or no Mx record it sets domain as KO fo further scans
 * @param  {string} element Field (from, cc, bcc..)
 * @param  {String} domain extracted domain name
 * @param  {object} oneEmail Email address and name
 * @param  {Array} database An array that represents a virtual database
 * @param  {RedisClientType} client Redis client
 * @param  {timer} timer Timer to wait Dns calls
 * @param  {Array} tempValidDomain Temporary array for valid domain(only alive for one scan) to prevent redis query
 */
function manipulateDataWithDns(
  element,
  domain,
  oneEmail,
  database,
  client,
  counter,
  tempArrayValid,
  tempArrayInValid,
  isScanned,
  folder,
  messageDate
) {
  /* istanbul ignore if */
  if (
    domain &&
    !tempArrayInValid.includes(domain) &&
    !tempArrayValid.includes(domain) &&
    !isScanned.includes(domain)
  ) {
    isScanned.push(domain);
    // add to timer if will check dns
    dns.resolveMx(domain, async (error, addresses) => {
      if (addresses) {
        if (addresses.length > 0) {
          tempArrayValid.push(domain);
          //set domain in redis
          await client.set(domain, "ok", {
            EX: 864000,
          });

          // append data when domain is valid
          manipulateData(element, oneEmail, database, folder, messageDate);
        }
      } else {
        tempArrayInValid.push(domain);
        counter.invalidAddresses += 1;
      }
    });
  }
  // if (tempValidDomain.includes(domain)) {
  //   return manipulateData(element, oneEmail, database);
  // }
}

/**
 * Treat parsed Emails, checks against redis and decide
 * @param  {object} dataTobeStored
 * @param  {Array} database An array that represents a virtual database
 * @param  {RedisClientType} client Redis client
 */
function treatParsedEmails(
  dataTobeStored,
  database,
  client,
  imapEmail,
  counter,
  tempArrayValid,
  tempArrayInValid,
  isScanned,
  folder
) {
  let messageDate = "";
  if (dataTobeStored.date) {
    messageDate = dataTobeStored.date[0];
    delete dataTobeStored.date;
  }

  Object.keys(dataTobeStored).forEach((element) => {
    if (true) {
      const email =
        element != "body"
          ? utilsForRegEx.extractNameAndEmail(
              dataTobeStored[element],
              imapEmail
            )
          : utilsForRegEx.FormatBodyEmail(dataTobeStored[element], imapEmail);
      // check existence in database or data array
      email.forEach(async (oneEmail) => {
        if (oneEmail) {
          const domain = oneEmail.address.split("@")[1];
          if (
            IsNotNoReply(oneEmail.address, imapEmail) &&
            !tempArrayInValid.includes(domain)
          ) {
            // check if already stored in cache (used to speed up domain validation)
            const domainRedis = await client.get(domain);
            // if domain already stored in cache

            if (domainRedis || tempArrayValid.includes(domain)) {
              manipulateData(element, oneEmail, database, folder, messageDate);
            } else if (!tempArrayInValid.includes(domain)) {
              manipulateDataWithDns(
                element,
                domain,
                oneEmail,
                database,
                client,
                counter,
                tempArrayValid,
                tempArrayInValid,
                isScanned,
                folder,
                messageDate
              );
            }
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
exports.parseDate = parseDate;
exports.compareDates = compareDates;
exports.manipulateData = manipulateData;
exports.manipulateDataWithDns = manipulateDataWithDns;
exports.treatParsedEmails = treatParsedEmails;
