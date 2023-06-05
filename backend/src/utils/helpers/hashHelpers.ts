import { createHmac } from 'crypto';
import { customAlphabet } from 'nanoid/async';
import ENV from '../../config';
import { FLICKR_BASE_58_CHARSET } from '../constants';

/**
 * Hashes an email address and a user id using the sha256 algorithm
 * @param emailAddress - The email address to be hashed
 * @param userId - The user id to be used as salt
 * @return - The hashed email address and user id
 */
export function hashEmail(emailAddress: string, userId: string) {
  return createHmac('sha256', ENV.LEADMINER_API_HASH_SECRET)
    .update(`${emailAddress}${userId}`)
    .digest('hex');
}

/**
 * Generates a random ID string using the Flickr Base58 encoding scheme.
 */
export function flickrBase58IdGenerator() {
  return customAlphabet(
    FLICKR_BASE_58_CHARSET,
    ENV.LEADMINER_MINING_ID_GENERATOR_LENGTH
  );
}
