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
 * hasSpecificHeader returns true if the email has specific types based on his headers
 * @returns A boolean value.
 */
function hasSpecificHeader(header, headerFields) {
  return Object.keys(header).some((headerField) => {
    return headerFields.some((regExHeader) => {
      const reg = new RegExp(`${regExHeader}`, 'i');
      return reg.test(headerField);
    });
  });
}

module.exports = {
  isNoReply,
  hasSpecificHeader
};
