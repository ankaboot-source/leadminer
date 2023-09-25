import { Contacts } from '../../db/interfaces/Contacts';
import EmailStatusCache from '../../services/cache/EmailStatusCache';
import EmailStatusVerifierFactory from '../../services/email-status/EmailStatusVerifierFactory';
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
 * @param emailStatusVerifierFactory - The email verification service.
 */
async function emailVerificationHandler(
  { userId, email }: EmailVerificationData,
  contacts: Contacts,
  emailStatusCache: EmailStatusCache,
  emailStatusVerifierFactory: EmailStatusVerifierFactory
) {
  try {
    const existingStatus = await emailStatusCache.get(email);
    if (!existingStatus) {
      const statusResult = await emailStatusVerifierFactory
        .getVerifier(email)
        .verify(email);
      logger.debug('Got verification results from verifier', {
        statusResult
      });
      await Promise.allSettled([
        emailStatusCache.set(email, statusResult),
        contacts.updateSinglePersonStatus(email, userId, statusResult)
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
  emailStatusVerifier: EmailStatusVerifierFactory
) {
  return {
    processStreamData: (message: EmailVerificationData) =>
      emailVerificationHandler(
        message,
        contacts,
        emailStatusCache,
        emailStatusVerifier
      )
  };
}
