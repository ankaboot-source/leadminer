const quotedPrintable = require("quoted-printable");
/* eslint-disable */
const regex = new RegExp(
  /((?<name>[\p{L}\p{M}.\p{L}\p{M}\w\W]{1,})\s)*(<|\[)*(?<address>[A-Za-z0-9!#$%&+?^_`{|\}~-]+(?:\.[A-Za-z0-9!#$%&'*+=?^_`\{|\}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)(>|\])*/imu
);
/* eslint-disable */
const regexForBody = new RegExp(
  /((?:[A-Za-z])[A-Za-z&^_`{|\}~-]+(?:\.[A-Za-z0-9&_`\{|\}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)/gimu
); ///^[a-zA-Z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+\/=?^_`{|}~-]+)*@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/
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
  /* istanbul ignore else */
  if (reg) {
    return [...new Set(reg)];
  } else return [];
}

/**
 * Using regEx extract emails addresses and users names if available.
 * @param  {object} data
 */
function extractNameAndEmail(data) {
  const getRegExp = (emailAfterRegEx) => {
    /* istanbul ignore else */
    if (emailAfterRegEx && emailAfterRegEx.groups.address.includes("@")) {
      if (!emailAfterRegEx.groups.name) {
        emailAfterRegEx.groups.name = "";
      }
      return emailAfterRegEx.groups;
    }
  };
  let email = data.split(",");
  if (email[1]) {
    let dataWithManyEmails = email.map((emails) => {
      let result = getRegExp(regex.exec(emails.trim()));
      return result;
    });
    return dataWithManyEmails;
  } else {
    let result = getRegExp(regex.exec(email));
    return [result];
  }
}

exports.extractNameAndEmail = extractNameAndEmail;
exports.extractNameAndEmailFromBody = extractNameAndEmailFromBody;
