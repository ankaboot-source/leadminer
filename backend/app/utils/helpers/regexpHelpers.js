const { REGEX_HEADER, REGEX_BODY, REGEX_REMOVE_QUOTES } = require('../constants');
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
  cleanedName = cleanedName.replace(REGEX_REMOVE_QUOTES, '$2');
  cleanedName = cleanedName.replace(REGEX_REMOVE_QUOTES, '$2'); // In case Some inputs have nested quotes like this "'word'"
  return cleanedName;
}

/**
 * Extracts email addresses, identifiers and names if available using regex.
 * @param  {string} emails - can be either comma-separated emails or one email.
 * @returns {Array} An array of obejcts
 */
function extractNameAndEmail(emails) {
  // Adding trainling comma at the end to help identify emails
  // Handle case when input have this format tester@leadminer.io <tester@leadminer.io>
  const result = [...`${emails},`.matchAll(REGEX_HEADER)].map((match) => {
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
