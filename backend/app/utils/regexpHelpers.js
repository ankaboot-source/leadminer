const quotedPrintable = require("quoted-printable");
/* eslint-disable */
const regex = new RegExp(
  /((?<name>[\p{L}\p{M}.\p{L}\p{M}\w\W]{1,})\s)*(<|\[)*(?<address>[A-Za-z0-9!#$%&+?^_`{|\}~-]+(?:\.[A-Za-z0-9!#$%&'*+=?^_`\{|\}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)(>|\])*/imu
);
/* eslint-disable */
const regexForBody = new RegExp(
  /((?:[A-Za-z])[A-Za-z&^_`{|\}~-]+(?:\.[A-Za-z0-9&_`\{|\}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)/gimu
);
/**
 * Extract Emails from body.
 * @param  {string} data A string that represents the mail body
 * @returns {Array} array of strings
 */
function extractNameAndEmailFromBody(data) {
  let reg = quotedPrintable
    .decode(data)
    .replaceAll("=", "")
    .match(regexForBody);
  if (reg) {
    return [...new Set(reg)];
  } else return [];
}

/**
 * Using regEx extract emails addresses and users names if available.
 * @param  {object} data
 */
function extractNameAndEmail(data) {
  // getRegEx returns a valid name and email regExgroup
  const getRegExp = (emailAfterRegEx) => {
    /* istanbul ignore else */
    // check if it's really an email address(check if it's not "undefined")
    if (emailAfterRegEx && emailAfterRegEx.groups.address.includes("@")) {
      if (!emailAfterRegEx.groups.name) {
        // if no name captured(name=undefined) we need to initialize it to empty string
        emailAfterRegEx.groups.name = "";
      }
      return emailAfterRegEx.groups;
    }
  };
  // data is array of emails addresses
  let email = data.split(/(?:,|;)+/);
  // case when we have more than one email
  if (email[1]) {
    let dataWithManyEmails = email.map((emails) => {
      // get the name and the Email
      let result = getRegExp(regex.exec(emails.trim()));
      return result;
    });
    return dataWithManyEmails;
  }
  // we have only one email address
  else {
    let result = getRegExp(regex.exec(email));
    return [result];
  }
}

exports.extractNameAndEmail = extractNameAndEmail;
exports.extractNameAndEmailFromBody = extractNameAndEmailFromBody;
