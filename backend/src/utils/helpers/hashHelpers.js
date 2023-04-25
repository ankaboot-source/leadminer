import { createHmac } from 'crypto';
import { customAlphabet } from 'nanoid/async';
import {
  LEADMINER_API_HASH_SECRET,
  LEADMINER_MINING_ID_GENERATOR_LENGTH
} from '../../config';
import { FLICKR_BASE_58_CHARSET } from '../constants';

/**
 * Hashes an email address and a user id using the sha256 algorithm
 * @param {string} emailAddress - The email address to be hashed
 * @param {string} userId - The user id to be used as salt
 * @return {string} - The hashed email address and user id
 */
export function hashEmail(emailAddress, userId) {
  const saltedUserId = emailAddress + userId;
  return createHmac('sha256', LEADMINER_API_HASH_SECRET)
    .update(saltedUserId)
    .digest('hex');
}

/**
 * Generates a random ID string using the Flickr Base58 encoding scheme.
 * @returns {Promise<string>} A Promise that resolves to a random ID string.
 */
export function flickrBase58IdGenerator() {
  const generator = customAlphabet(
    FLICKR_BASE_58_CHARSET,
    LEADMINER_MINING_ID_GENERATOR_LENGTH || 10
  );
  return generator;
}
