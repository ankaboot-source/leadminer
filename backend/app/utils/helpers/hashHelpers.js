const crypto = require('crypto');
const { LEADMINER_API_HASH_SECRET } = require('../../config');

/**
 * Hashes an email address and a user id using the sha256 algorithm
 * @param {string} emailAddress - The email address to be hashed
 * @param {string} userId - The user id to be used as salt
 * @return {string} - The hashed email address and user id
 */
function hashEmail(emailAddress, userId) {
  const saltedUserId = emailAddress + userId;
  return crypto
    .createHmac('sha256', LEADMINER_API_HASH_SECRET)
    .update(saltedUserId)
    .digest('hex');
}
/**
 * Generates unique processID.
 * @param {*} userId 
 * @returns 
 */
function generateUniqueId(userId) {
  const processId = crypto.randomUUID();
  return `${userId}-${processId}`;
}

module.exports = {
  hashEmail,
  generateUniqueId
};
