const crypto = require('crypto');
const { hashSecret } = require('../../config/server.config');

/**
 * hashEmail takes an email address, runs it through a cryptographic hash function, and returns the result
 * @param emailAddress - The email address to hash.
 * @returns A hash of the email address.
 */
function hashEmail(emailAddress) {
  return crypto
    .createHmac('sha256', hashSecret)
    .update(emailAddress)
    .digest('hex');
}

module.exports = {
  hashEmail
};
