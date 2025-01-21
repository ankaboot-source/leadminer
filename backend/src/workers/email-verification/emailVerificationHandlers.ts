import { Contacts } from '../../db/interfaces/Contacts';
import EmailStatusCache from '../../services/cache/EmailStatusCache';
import {
  EmailStatusResult,
  EmailStatusVerifier
} from '../../services/email-status/EmailStatusVerifier';
import EmailStatusVerifierFactory from '../../services/email-status/EmailStatusVerifierFactory';
import logger from '../../utils/logger';

export interface EmailVerificationData {
  userId: string;
  email: string;
  miningId: string;
}

function logRejectedAndReturnResolved<T>(
  results: PromiseSettledResult<T>[],
  context: string
): T[] {
  results
    .filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    )
    .forEach((result) => {
      logger.error(`${context}: Promise rejected`, {
        error: result.reason,
        timestamp: new Date().toISOString()
      });
    });

  return results
    .filter(
      (result): result is PromiseFulfilledResult<T> =>
        result.status === 'fulfilled'
    )
    .map((result) => result.value);
}

async function ThrottleAsyncVerification(
  batchSize: number,
  emails: string[],
  verifier: EmailStatusVerifier
) {
  const results: EmailStatusResult[] = [];
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    results.push(
      ...logRejectedAndReturnResolved<EmailStatusResult>(
        // eslint-disable-next-line no-await-in-loop
        await Promise.allSettled(batch.map((email) => verifier.verify(email))),
        'Async email status verification'
      )
    );
  }

  return results;
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
    // update email status from cache
    const cachePromises = verificationData.map(async ({ userId, email }) => {
      const existingStatus =
        (await emailStatusCache.get(email)) ??
        (await contacts.SelectRecentEmailStatus(email));

      if (!existingStatus) {
        waitingForVerification.set(email, userId);
        return;
      }

      logger.debug('Cached result', {
        email,
        verifier: 'CACHED',
        result: existingStatus
      });

      await contacts.upsertEmailStatus({
        verifiedOn: new Date().toISOString(),
        ...existingStatus, // overwrites verifiedOn if exists.
        email,
        userId
      });
    });

    logRejectedAndReturnResolved(
      await Promise.allSettled(cachePromises),
      'Updating email status from cache'
    );

    const verifiers = emailStatusVerifierFactory.getEmailVerifiers(
      Array.from(waitingForVerification.keys())
    );

    // Perform email status verification
    const verificationPromises = Array.from(verifiers.entries()).map(
      async ([verifierName, [verifier, emails]]) => {
        const startTime = performance.now();

        logger.info(
          `[${verifierName}]: Verification started with ${emails.length} email(s)`,
          { started_at: startTime }
        );

        const verified =
          verifierName === 'mailercheck' && emails.length > 100
            ? await verifier.verifyMany(emails)
            : await ThrottleAsyncVerification(200, emails, verifier);

        logger.info(
          `[${verifierName}]: Verification completed with ${verified.length} results`,
          {
            started_at: startTime,
            stopped_at: performance.now(),
            duration: performance.now() - startTime
          }
        );

        return { verifierName, verified };
      }
    );

    const verificationResult = logRejectedAndReturnResolved(
      await Promise.allSettled(verificationPromises),
      'Email verification failed'
    );

    // Update email status
    const promises = verificationResult.flatMap(({ verified }) =>
      verified.map(async (result) => {
        const { email } = result;
        const userId = waitingForVerification.get(email);

        if (!userId) {
          logger.warn('No userId found to update email status.', { email });
          return;
        }
        try {
          emailStatusCache.set(email, result);
          await contacts.upsertEmailStatus({
            email,
            userId,
            status: result.status,
            details: result.details,
            verifiedOn: new Date().toISOString()
          });
        } catch (error) {
          logger.error('Error updating email status', {
            email,
            result,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      })
    );

    await Promise.allSettled(promises);
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
