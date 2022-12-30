const { noreplyHeaders } = require('../../config/emailHeaders.config');

/**
 * IsNoReply takes an email address as a string and returns true if the email address is classified as "no-reply email"
 * @param address - The email address to check
 * @returns A boolean value.
 */
function isNoReply(emailAddress) {
  return noreplyHeaders.some((word) => {
    return emailAddress.toLowerCase().includes(word.toLowerCase());
  });
}

/**
 * Gets the first matching header value from a list of header fields if it exists.
 * @param {Object} Header - Header object.
 * @param {string[]} headerFields - A list of possible header fields.
 * @returns Header value or null.
 */
function getSpecificHeader(header, headerFields) {
  for (const headerField of Object.keys(header)) {
    const firstMatch = headerFields.find(
      (current) => current.toLowerCase() === headerField.toLowerCase()
    );
    if (firstMatch) {
      return header[`${firstMatch}`];
    }
  }
  return null;
}

module.exports = {
  isNoReply,
  getSpecificHeader
};
