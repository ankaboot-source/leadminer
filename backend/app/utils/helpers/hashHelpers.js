const crypto = require('crypto');
const { hashSecret } = require('../../config/server.config');

/**
 * Hashes an email address and a user id using the sha256 algorithm
 * @param {string} emailAddress - The email address to be hashed
 * @param {string} userId - The user id to be used as salt
 * @return {string} - The hashed email address and user id
 */
function hashEmail(emailAddress, userId) {
  const saltedUserId = emailAddress + userId;
  return crypto
    .createHmac('sha256', hashSecret)
    .update(saltedUserId)
    .digest('hex');
}

module.exports = {
  hashEmail
};
