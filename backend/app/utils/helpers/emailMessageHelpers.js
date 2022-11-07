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

module.exports = {
  isNoReply
};
