const quotedPrintable = require('quoted-printable');

/* eslint-disable */
const headerEmailRegex = /(?<=<|\s|^)(?<identifier>[\w-]+(?:[+.][\w]+)*)@(?<domain>(?:[\w-]+\.)*\w[\w-]{0,66})\.(?<tld>[a-z]{2,18}?)(?=$|\s|>)/
const bodyEmailRegex = new RegExp(
  /(?<=<|\s|^|"mailto:)(?<identifier>[\w-]+(?:[+.][\w]+)*)@(?<domain>(?:[\w-]+\.)*\w[\w-]{0,66})\.(?<tld>[a-z]{2,18}?)(?=$|\s|>|")/gi
);

/**
 * getRegex - Returns the current used regex.
 */
function getRegex() {
  return [bodyEmailRegex, headerEmailRegex]
}

/**
 * Extract Emails from body.
 * @param  {string} data A string that represents the mail body
 * @returns {Array} array of strings
 */
function extractNameAndEmailFromBody(data) {
  const reg = quotedPrintable
    .decode(data)
    .match(bodyEmailRegex)
  if (reg) {
    return [...new Set(reg)];
  } else return [];
}

/**
 * Extracts email addresses, identifiers and names if available using regex.
 * @param  {string} emails - can be either comma-separated emails or one email.
 * @returns {Array} An array of obejcts
 */
function extractNameAndEmail(emails) {

  const result = []

  for (const email of emails.split(',')) {

    let emailData = email.match(headerEmailRegex.source)

    if (emailData) {
      emailData = {

        name: email.split(' ').slice(0, -1).join(' ').trim(), // -1 to exclude email.
        address: emailData[0],
        identifier: emailData.groups.identifier

      }
      result.push(emailData)
    }
  }
  return result
}

exports.extractNameAndEmail = extractNameAndEmail;
exports.extractNameAndEmailFromBody = extractNameAndEmailFromBody;
exports.getRegEx = getRegex;