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
 * Returns the extracted name from a space-seperated name email input.
 * @param {string} text - The input from which the name is extracted.
 * @returns {string} The extracted name, or an empty string if no name is found.
 */
function extractName(text) {
  return text.lastIndexOf(' ') !== -1
    ? text.slice(0, text.lastIndexOf(' ')).trim().replace(/"/g, '')
    : '';
}

/**
 * Extracts email addresses, identifiers and names if available using regex.
 * @param  {string} emails - can be either comma-separated emails or one email.
 * @returns {Array} An array of obejcts
 */
function extractNameAndEmail(emails) {
  return emails
    .split(',')
    .map((email) => {
      const match = email.match(REGEX_HEADER.source);

      if (!match) {
        return null;
      }

      const { identifier, domain, tld } = match.groups ?? {};
      const address = match[0].toLocaleLowerCase();
      const name = extractName(email);

      return {
        name: name === address ? '' : name,
        address,
        identifier,
        domain: `${domain}.${tld}`
      };
    })
    .filter(Boolean);
}

module.exports = {
  extractNameAndEmail,
  extractNameAndEmailFromBody,
  extractName
};
