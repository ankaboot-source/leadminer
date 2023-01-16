const { REGEX_HEADER, REGEX_BODY } = require('../constants');
const quotedPrintable = require('quoted-printable');

/**
 * Extract Emails from body.
 * @param  {string} data A string that represents the mail body
 * @returns {Array} array of strings
 */
function extractNameAndEmailFromBody(data) {
  const reg = quotedPrintable.decode(data).match(REGEX_BODY);
  if (reg) {
    return [...new Set(reg)];
  }
  return [];
}

/**
 * Extracts email addresses, identifiers and names if available using regex.
 * @param  {string} emails - can be either comma-separated emails or one email.
 * @returns {Array} An array of obejcts
 */
function extractNameAndEmail(emails) {
  
  const result = [];
  const emailsArr = emails.split(',');

  for (const email of emailsArr) {
    const emailData = email.match(REGEX_HEADER.source);
    if (emailData) {
      result.push({
        name: email.lastIndexOf(' ') !== -1 ? email.slice(0, email.lastIndexOf(' ')).trim().replace(/"/g, '') : '',
        address: emailData[0].toLocaleLowerCase(),
        identifier: emailData.groups?.identifier,
        domain: emailData.groups?.domain
      });
    }
  }
  return result;
}

exports.extractNameAndEmail = extractNameAndEmail;
exports.extractNameAndEmailFromBody = extractNameAndEmailFromBody;
