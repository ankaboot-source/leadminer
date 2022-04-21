const utilsForDataManipulation = require("./extractors");
/* eslint-disable */
const regex = new RegExp(
  /((?<name>[\p{L}\p{M}.\p{L}\p{M}\d\s{|\}~()-]{1,})"*\s)*(<|\[)*(?<address>[A-Za-z0-9!#$%&+?^_`{|\}~-]+(?:\.[A-Za-z0-9!#$%&'*+=?^_`\{|\}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)(>|\])*/imu
);
/* eslint-disable */
const regexForBody = new RegExp(
  /([A-Za-z0-9!#$%&'+=?^_`{|\}~-]+(?:\.[A-Za-z0-9!#$%&'*+=?^_`\{|\}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)/gimu
);

/**
 * Extract Emails from body.
 * @param  {string} data A string that represents the mail body
 */
function extractEmailsFromBody(data) {
  let reg = data.match(regexForBody);
  if (reg) {
    return reg;
  }
}

/**
 * Using regEx extract email address and user name if available.
 * @param  {object} ImapData
 */
function extractNameAndEmail(data) {
  const getRegExp = (email, emailAfterRegEx) => {
    if (emailAfterRegEx && emailAfterRegEx.groups.address.includes("@")) {
      return emailAfterRegEx.groups;
    } else {
      return {
        name: email.substring(0, email.indexOf("<")),
        address: email
          .substring(email.indexOf("<"), email.length)
          .replace("<", "")
          .replace(">", ""),
      };
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

    let result = getRegExp(email[0], emailAfterRegEx);
    return [result];
  }
}
/**
 * @param  {string} data change extracted body email into {name,address} format (related to frontend data)
 */
function FormatBodyEmail(data) {
  if (data) {
    return data.map((oneEmail) => {
      return { name: "", address: oneEmail };
    });
  }
}

exports.extractNameAndEmail = extractNameAndEmail;
exports.extractEmailsFromBody = extractEmailsFromBody;
exports.FormatBodyEmail = FormatBodyEmail;
