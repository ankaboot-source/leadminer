import { createHmac } from 'crypto';
import ENV from '../../config';

/**
 * Hashes an email address and a user id using the sha256 algorithm
 * @param emailAddress - The email address to be hashed
 * @param userId - The user id to be used as salt
 * @return - The hashed email address and user id
 */
export default function hashEmail(emailAddress: string, userId: string) {
  return createHmac('sha256', ENV.LEADMINER_API_HASH_SECRET)
    .update(`${emailAddress}${userId}`)
    .digest('hex');
}
