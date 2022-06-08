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
function extractEmailsFromBody(data) {
  let reg = quotedPrintable.decode(data).match(regexForBody);
  /* istanbul ignore else */
  if (reg) {
    return reg;
  }
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
  let email = data[0].split(",");
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
/**
 * Change extracted body email into {name,address} format
 * @param  {Array} data array of emails objects
 * @returns {Array} formated array of object
 */
function FormatBodyEmail(data) {
  /* istanbul ignore else */
  if (data) {
    return data.map((oneEmail) => {
      return { name: "", address: oneEmail };
    });
  }
}

exports.extractNameAndEmail = extractNameAndEmail;
exports.extractEmailsFromBody = extractEmailsFromBody;
exports.FormatBodyEmail = FormatBodyEmail;
