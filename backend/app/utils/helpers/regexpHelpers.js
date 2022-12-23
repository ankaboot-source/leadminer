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

  for (const email of emails.split(',')) {
    let emailData = email.match(REGEX_HEADER.source);

    if (emailData) {
      emailData = {
        name: email.split(' ').slice(0, -1).join(' ').trim(), // -1 to exclude email.
        address: emailData[0],
        identifier: emailData.groups.identifier
      };
      result.push(emailData);
    }
  }
  return result;
}

exports.extractNameAndEmail = extractNameAndEmail;
exports.extractNameAndEmailFromBody = extractNameAndEmailFromBody;
