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
 * @param {string} name - The input from which the name is extracted.
 * @returns {string} The extracted name, or an empty string if no name is found.
 */
function cleanName(name) {
  let cleanedName = name.trim();
  if (
    (cleanedName.charAt(0) === "'" && cleanedName.charAt(cleanedName.length - 1) === "'") ||
    (cleanedName.charAt(0) === '"' && cleanedName.charAt(cleanedName.length - 1) === '"')
  ) {
    cleanedName = cleanedName.substring(1, cleanedName.length - 1);
  }
  return cleanedName;
}

/**
 * Extracts email addresses, identifiers and names if available using regex.
 * @param  {string} emails - can be either comma-separated emails or one email.
 * @returns {Array} An array of obejcts
 */
function extractNameAndEmail(emails) {
  const result = [...emails.matchAll(REGEX_HEADER)].map((match) => {
    const { name, address, identifier, domain, tld } = match.groups ?? {};
    const cleanAddress = address.toLowerCase();
    const cleanedName = cleanName(name || '');
    return {
      name: cleanedName !== cleanAddress ? cleanedName : '',
      address: cleanAddress,
      identifier,
      domain: `${domain}.${tld}`
    };
  });
  return result;
}

module.exports = {
  extractNameAndEmail,
  extractNameAndEmailFromBody,
  cleanName
};
