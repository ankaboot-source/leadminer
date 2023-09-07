import { Contacts } from '../../db/interfaces/Contacts';
import EmailStatusCache from '../../services/cache/EmailStatusCache';
import { EmailStatusVerifier } from '../../services/email-status/EmailStatusVerifier';
import logger from '../../utils/logger';

export interface EmailVerificationData {
  userId: string;
  email: string;
  miningId: string;
}

/**
 * Performs verification on the provided emails then caches and writes the results to db.
 * @param data - The verification data.
 * @param contacts - The contacts db accessor.
 * @param emailStatusCache - The emails status cache accessor.
 * @param emailStatusVerifier - The email verification service.
 */
async function emailVerificationHandler(
  { userId, email }: EmailVerificationData,
  contacts: Contacts,
  emailStatusCache: EmailStatusCache,
  emailStatusVerifier: EmailStatusVerifier
) {
  try {
    const existingStatus = await emailStatusCache.get(email);
    if (!existingStatus) {
      const { status } = await emailStatusVerifier.verify(email);
      logger.debug('Got verification results from verifier', {
        status,
        email
      });
      await Promise.allSettled([
        emailStatusCache.set(email, status),
        contacts.updateSinglePersonStatus(email, userId, status)
      ]);
    } else {
      await contacts.updateSinglePersonStatus(email, userId, existingStatus);
    }
  } catch (error) {
    logger.error('Failed when processing message from the stream', error);
  }
}

export default function initializeEmailVerificationProcessor(
  contacts: Contacts,
  emailStatusCache: EmailStatusCache,
  emailStatusVerifier: EmailStatusVerifier
) {
  return {
    processStreamData: async (message: EmailVerificationData) =>
      emailVerificationHandler(
        message,
        contacts,
        emailStatusCache,
        emailStatusVerifier
      )
  };
}
