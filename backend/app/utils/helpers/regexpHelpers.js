const quotedPrintable = require('quoted-printable');


/* eslint-disable */
const regexForBody = new RegExp(
  /(?<=<|\s|^|"mailto:)(?<identifier>[\w-]+(?:[+.][\w]+)*)@(?<domain>(?:[\w-]+\.)*\w[\w-]{0,66})\.(?<tld>[a-z]{2,18}?)(?=$|\s|>|")/gi
);

/**
 * getRegex - Returns the current used regex.
 */
function getRegex() {
  return [regexForBody]
}

/**
 * Extract Emails from body.
 * @param  {string} data A string that represents the mail body
 * @returns {Array} array of strings
 */
function extractNameAndEmailFromBody(data) {
  const reg = quotedPrintable
    .decode(data)
    .match(regexForBody)
  if (reg) {
    return [...new Set(reg)];
  } else return [];
}

/**
 * Using regEx extract emails addresses, identifiers and names if available.
 * @param  {string} data - string represents one or multiple emails.   
 */
function extractNameAndEmail(data) {

  const emails = []

  for (const email of data.split(',')) {

    let emailData = email.match(regexForBody.source)

    if (emailData) {
      emailData = {

        name: email.split(' ').slice(0, -1).join(' ').trim(), // -1 to exclude email.
        address: emailData[0],
        identifier: emailData.groups.identifier

      }
      emails.push(emailData)
    }
  }
  return emails
}

exports.extractNameAndEmail = extractNameAndEmail;
exports.extractNameAndEmailFromBody = extractNameAndEmailFromBody;
exports.getRegEx = getRegex;