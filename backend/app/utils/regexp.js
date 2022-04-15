var fs = require("fs");
/* eslint-disable */
const logger = require("./logger")(module);
const ValidDomainsSet = require("./ValidDomains.json");
const InvalidDomainsSet = require("./InvalidDomains.json");
const dns = require("dns");
/* eslint-disable */
const regex = new RegExp(
  /((?<name>[\p{L}\p{M}'.\p{L}\p{M}\d\s\(\)A-Za-z0-9!#$%&'*+\/=?^_`\{|\}~-]{1,})"*\s)*(<|\[)*(?<address>[A-Za-z0-9!#$%&'+\/=?^_`\{|\}~-]+(?:\.[A-Za-z0-9!#$%&'*+\/=?^_`\{|\}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)(>|\])*/gimu
);
/* eslint-disable */
const regexForBody = new RegExp(
  /(:(?<name>[\p{L}\p{M}*',.\p{L}\p{M}\d\s\(\)-]{1,}))*(<|\[)*(?<address>[A-Za-z0-9!#$%&'+\/=?^_`\{|\}~-]+(?:\.[A-Za-z0-9!#$%&'*+\/=?^_`\{|\}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)(>|\])*/gimu
);

/**
 * Extract Emails from body.
 * @param  {string} data A string that represents the mail body
 */
function extractEmailsFromBody(data) {
  let reg = data.match(regexForBody);
  if (reg) {
    return [reg.join(",")];
  }
}

/**
 * Using regEx extract email address and user name if available.
 * @param  {object} ImapData
 */
function extractNameAndEmail(data) {
  const getRegExp = (email, emailAfterRegEx) => {
    if (emailAfterRegEx) {
      return emailAfterRegEx.groups;
    } else if (email) {
      return {
        name: email[0].substring(0, email.indexOf("<")),
        address: email[0]
          .substring(email[0].indexOf("<"), email[0].length)
          .replace("<", "")
          .replace(">", ""),
      };
    }
  };
  let email = data[0].split(">");
  if (email[1]) {
    let dataWithManyEmails = email.map((emails) => {
      let Emails = emails.trim();
      let emailAfterRegEx = regex.exec(Emails);
      let result = getRegExp(emails, emailAfterRegEx);
      return result;
    });
    return dataWithManyEmails;
  } else {
    let emailAfterRegEx = regex.exec(email);
    let result = getRegExp(email, emailAfterRegEx);
    return [result];
  }
}
/**
 * @param  {string} data An appar
 */
function extractNameAndEmailForBody(data) {
  const getRegExp = (email, emailAfterRegEx) => {
    if (emailAfterRegEx) {
      return emailAfterRegEx.groups;
    }
  };
  let email = data[0].split(",");
  if (email[1]) {
    let dataWithManyEmails = email.map((emails) => {
      let Emails = emails.trim();

      let emailAfterRegEx = regex.exec(Emails);
      let result = getRegExp(emails, emailAfterRegEx);
      return result;
    });
    return dataWithManyEmails;
  } else {
    let emailAfterRegEx = regex.exec(email);
    let result = getRegExp(email, emailAfterRegEx);
    return [result];
  }
}

function EqualPartsForSocket(total) {
  let boxCount = total;
  const values = [];
  let n = boxCount > 1000 ? 10 : 6;
  while (boxCount > 0 && n > 0) {
    const a = Math.floor(boxCount / n);
    boxCount -= a;
    n--;
    values.push(a);
  }
  const Parts = [];
  values.reduce((prev, curr, i) => (Parts[i] = prev + curr), 0);
  return Parts;
}

exports.extractNameAndEmail = extractNameAndEmail;
exports.extractEmailsFromBody = extractEmailsFromBody;
exports.extractNameAndEmailForBody = extractNameAndEmailForBody;
exports.EqualPartsForSocket = EqualPartsForSocket;
