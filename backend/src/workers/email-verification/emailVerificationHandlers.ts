import { Contacts } from '../../db/interfaces/Contacts';
import EmailStatusCache from '../../services/cache/EmailStatusCache';
import { EmailStatusResult } from '../../services/email-status/EmailStatusVerifier';
import EmailStatusVerifierFactory from '../../services/email-status/EmailStatusVerifierFactory';
import logger from '../../utils/logger';

export interface EmailVerificationData {
  userId: string;
  email: string;
  miningId: string;
}

/**
 * Performs verification either in bulk or single checks on the provided emails,
 * then caches and writes the results to the database.
 *
 * @param data - Array of verification data, containing { userId, email }.
 * @param contacts - The contacts db accessor.
 * @param emailStatusCache - The emails status cache accessor.
 * @param emailStatusVerifierFactory - The factory providing email verification services.
 */
async function emailVerificationHandlerWithBulk(
  verificationData: EmailVerificationData[],
  contacts: Contacts,
  emailStatusCache: EmailStatusCache,
  emailStatusVerifierFactory: EmailStatusVerifierFactory
) {
  const waitingForVerification = new Map();

  try {
    const verificationChecks = verificationData.map(
      async ({ userId, email }) => {
        const existingStatus = await emailStatusCache.get(email);

        if (existingStatus) {
          logger.debug('Updating person with verification results', {
            email,
            verifier: 'CACHED',
            result: existingStatus
          });
          await contacts.updateSinglePersonStatus(
            email,
            userId,
            existingStatus
          );
          logger.debug(`Updated person with verification results`, {
            email,
            verifier: 'CACHED',
            result: existingStatus
          });
        } else {
          waitingForVerification.set(email, userId);
        }
      }
    );
    await Promise.allSettled(verificationChecks);

    const verificationChecksResults =
      await Promise.allSettled(verificationChecks);

    verificationChecksResults.forEach((result) => {
      if (result.status === 'rejected') {
        logger.error(
          'Error updating verification status from cache',
          result.reason
        );
      }
    });

    const verifiers = emailStatusVerifierFactory.getEmailVerifiers(
      Array.from(waitingForVerification.keys())
    );

    const verifierPromises = Array.from(verifiers.entries()).map(
      async ([verifierName, [verifier, emails]]) => {
        const startTime = performance.now();
        try {
          logger.info(
            `[${verifierName}]: Starting verification with ${emails.length} email`,
            { started_at: startTime }
          );

          const verified =
            verifierName === 'mailercheck' && emails.length > 100
              ? await verifier.verifyMany(emails)
              : (
                  await Promise.allSettled(
                    emails.map((email) => verifier.verify(email))
                  )
                )
                  .filter(
                    (
                      promise
                    ): promise is PromiseFulfilledResult<EmailStatusResult> =>
                      promise.status === 'fulfilled'
                  )
                  .flatMap((promise) => promise.value);

          logger.info(
            `[${verifierName}]: Verification completed with ${verified.length} results`,
            {
              started_at: startTime,
              stopped_at: performance.now(),
              duration: performance.now() - startTime
            }
          );

          const updatePromises = verified.map(async (verificationStatus) => {
            const { email } = verificationStatus;
            const userId = waitingForVerification.get(email);
            logger.debug('Updating person with verification results', {
              email,
              verifier: verifierName,
              result: verificationStatus
            });
            if (userId) {
              await emailStatusCache.set(email, verificationStatus);
              await contacts.updateSinglePersonStatus(
                email,
                userId,
                verificationStatus
              );
              logger.debug('Updated person with verification results', {
                email,
                verifier: verifierName,
                result: verificationStatus
              });
            }
          });

          const updateResults = await Promise.allSettled(updatePromises);

          updateResults.forEach((result) => {
            if (result.status === 'rejected') {
              logger.error(
                `Error updating verification status from ${verifierName}`,
                result.reason
              );
            }
          });
        } catch (verifierError) {
          logger.error(
            `[${verifierName}]: Failed to verify emails`,
            verifierError
          );
        }
      }
    );

    const allVerifierResults = await Promise.allSettled(verifierPromises);

    allVerifierResults.forEach((result) => {
      if (result.status === 'rejected') {
        logger.error('Error in verifier promise', result.reason);
      }
    });
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
    processStreamData: (message: EmailVerificationData[]) =>
      emailVerificationHandlerWithBulk(
        message,
        contacts,
        emailStatusCache,
        emailStatusVerifier
      )
  };
}
