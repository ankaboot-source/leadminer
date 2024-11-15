import { Contacts } from '../../db/interfaces/Contacts';
import EmailStatusCache from '../../services/cache/EmailStatusCache';
import {
  EmailStatusResult,
  EmailVerifierType
} from '../../services/email-status/EmailStatusVerifier';
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
    for (const { userId, email } of verificationData) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const existingStatus = await emailStatusCache.get(email);

        if (existingStatus) {
          logger.debug('Updating person with verification results', {
            email,
            verifier: 'CACHED',
            result: existingStatus
          });
          // eslint-disable-next-line no-await-in-loop
          await contacts.updateSinglePersonStatus(
            email,
            userId,
            existingStatus
          );
          logger.debug('Updated person with verification results', {
            email,
            verifier: 'CACHED',
            result: existingStatus
          });
        } else {
          waitingForVerification.set(email, userId);
        }
      } catch (err) {
        logger.error('Error updating verification status from cache', err);
      }
    }

    const verifiers = emailStatusVerifierFactory.getEmailVerifiers(
      Array.from(waitingForVerification.keys())
    );

    const verificationResult = (
      await Promise.allSettled(
        Array.from(verifiers.entries()).map(
          async ([verifierName, [verifier, emails]]) => {
            const startTime = performance.now();
            try {
              logger.info(
                `[${verifierName}]: Starting verification with ${emails.length} email(s)`,
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

              return { verifierName, verified };
            } catch (error) {
              logger.error(`[${verifierName}]: Verification failed`, { error });
              throw error;
            }
          }
        )
      )
    )
      .filter(
        (
          promise
        ): promise is PromiseFulfilledResult<{
          verifierName: EmailVerifierType;
          verified: EmailStatusResult[];
        }> => promise.status === 'fulfilled'
      )
      .flatMap((promise) => promise.value);

    for (const { verifierName, verified } of verificationResult) {
      for (const result of verified) {
        const { email } = result;
        const userId = waitingForVerification.get(email);

        if (!userId) {
          logger.warn('No userId found for verified email', { email });
          continue;
        }

        try {
          logger.debug('Updating person with verification results', {
            email,
            verifier: verifierName,
            result
          });

          // eslint-disable-next-line no-await-in-loop
          await emailStatusCache.set(email, result);
          // eslint-disable-next-line no-await-in-loop
          await contacts.updateSinglePersonStatus(email, userId, result);

          logger.debug('Updated person with verification results', {
            email,
            verifier: verifierName,
            result
          });
        } catch (updateError) {
          logger.error(
            `Error updating verification status from ${verifierName}`,
            {
              email,
              error: updateError
            }
          );
        }
      }
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
    processStreamData: (message: EmailVerificationData[]) =>
      emailVerificationHandlerWithBulk(
        message,
        contacts,
        emailStatusCache,
        emailStatusVerifier
      )
  };
}
