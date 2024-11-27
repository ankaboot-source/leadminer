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
        const existingStatus =
          // eslint-disable-next-line no-await-in-loop
          (await emailStatusCache.get(email)) ??
          // eslint-disable-next-line no-await-in-loop
          (await contacts.SelectRecentEmailStatus(email));

        if (existingStatus) {
          logger.debug('Updating email status from cache.', {
            email,
            verifier: 'CACHED',
            result: existingStatus
          });
          // eslint-disable-next-line no-await-in-loop
          await contacts.upsertEmailStatus({
            verifiedOn: new Date().toISOString(),
            ...existingStatus, // overwrites verifiedOn if exists.
            email,
            userId
          });
        } else {
          waitingForVerification.set(email, userId);
        }
      } catch (err) {
        logger.error('Error updating email status from cache', err);
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
                `[${verifierName}]: Verification started with ${emails.length} email(s)`,
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
          logger.warn('No userId found to update email status.', { email });
          continue;
        }

        try {
          logger.debug('Updating email status', {
            email,
            result,
            verifierName
          });
          // eslint-disable-next-line no-await-in-loop
          await emailStatusCache.set(email, result);
          // eslint-disable-next-line no-await-in-loop
          await contacts.upsertEmailStatus({
            email,
            userId,
            status: result.status,
            details: result.details,
            verifiedOn: new Date().toISOString()
          });
        } catch (updateError) {
          logger.error('Error updating email status', {
            email,
            result,
            verifierName,
            error: updateError
          });
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
