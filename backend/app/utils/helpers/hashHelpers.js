const crypto = require('crypto');
const { customAlphabet } = require('nanoid/async');
const { FLICKR_BASE_58_CHARSET } = require('../constants');
const { LEADMINER_API_HASH_SECRET, LEADMINER_MINING_ID_GENERATOR_LENGTH } = require('../../config');

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
 * Generates a random ID string using the Flickr Base58 encoding scheme.
 * @returns {Promise<string>} A Promise that resolves to a random ID string.
 */
async function flickrBase58IdGenerator() {
  const generator = customAlphabet(LEADMINER_MINING_ID_GENERATOR_LENGTH, MINING_ID_LENGTH);
  return generator;
}


module.exports = {
  hashEmail,
  flickrBase58IdGenerator
};
