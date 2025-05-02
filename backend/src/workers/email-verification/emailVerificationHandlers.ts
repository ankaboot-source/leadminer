import { Logger } from 'winston';
import { Contacts } from '../../db/interfaces/Contacts';
import EmailStatusCache from '../../services/cache/EmailStatusCache';
import {
  EmailStatusResult,
  EmailStatusVerifier,
  EmailVerifierType
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
        error: result.reason.message,
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

class EmailVerificationHandler {
  private readonly WAITING_FOR_VERIFICATION: Map<string, string>;

  constructor(
    private readonly contacts: Contacts,
    private readonly emailStatusCache: EmailStatusCache,
    private readonly emailStatusVerifier: EmailStatusVerifierFactory,

    private readonly progressCallback: (verified: number) => Promise<void>,
    private readonly classLogger: Logger,
    private readonly verificationData: EmailVerificationData[]
  ) {
    this.WAITING_FOR_VERIFICATION = new Map<string, string>();
  }

  private static createEmailVerificationBatches(
    emailAddresses: string[],
    batchSize: number,
    verifierName: string,
    verifier: EmailStatusVerifier
  ): [EmailStatusVerifier, string, string[]][] {
    const verificationBatches: [EmailStatusVerifier, string, string[]][] = [];

    for (let i = 0; i < emailAddresses.length; i += batchSize) {
      const currentBatch = emailAddresses.slice(i, i + batchSize);
      verificationBatches.push([verifier, verifierName, currentBatch]);
    }

    return verificationBatches;
  }

  private async isExistingStatus(email: string) {
    const existingStatus =
      (await this.emailStatusCache.get(email)) ??
      (await this.contacts.SelectRecentEmailStatus(email));
    return existingStatus;
  }

  private async updateStatus(
    userId: string,
    email: string,
    status: EmailStatusResult
  ) {
    this.emailStatusCache.set(email, status);
    return this.contacts.upsertEmailStatus({
      verifiedOn: new Date().toISOString(),
      ...status,
      email,
      userId
    });
  }

  private async getUpdateStatusCache() {
    const cachePromises = this.verificationData.map(
      async ({ userId, email }) => {
        const existing = await this.isExistingStatus(email);
        if (existing) {
          await this.updateStatus(userId, email, existing);
        } else {
          this.WAITING_FOR_VERIFICATION.set(email, userId);
        }
      }
    );

    logRejectedAndReturnResolved(
      await Promise.allSettled(cachePromises),
      `[${this.constructor.name}.getUpdateStatusCache]:Updating email status from cache`
    );

    logRejectedAndReturnResolved(
      await Promise.allSettled([
        await this.progressCallback(
          this.verificationData.map(({ email }) => email).length -
            this.WAITING_FOR_VERIFICATION.size
        )
      ]),
      `[${this.constructor.name}.getUpdateStatusCache]: Sending progress`
    );
  }

  private logVerificationStarted(
    emailsLength: number,
    verifierName: string,
    startTime: number
  ) {
    this.classLogger.info(
      `Verification started with ${emailsLength} email(s)`,
      {
        engine: verifierName,
        started_at: startTime
      }
    );
  }

  private logVerificationCompleted(
    emailsLength: number,
    verifierName: string,
    startTime: number
  ) {
    this.classLogger.info(
      `[Verification completed with ${emailsLength} results`,
      {
        started_at: startTime,
        stopped_at: performance.now(),
        duration: performance.now() - startTime,
        engine: verifierName
      }
    );
  }

  private async verifyEmails(
    emails: string[],
    verifier: EmailStatusVerifier,
    verifierName: string
  ) {
    const startTime = performance.now();

    this.logVerificationStarted(emails.length, verifierName, startTime);

    const results = logRejectedAndReturnResolved<EmailStatusResult>(
      // eslint-disable-next-line no-await-in-loop
      await Promise.allSettled(emails.map((email) => verifier.verify(email))),
      `[${this.constructor.name}.verifyEmails]: Batch email status verification`
    );

    logRejectedAndReturnResolved(
      await Promise.allSettled(
        results.map(async (result) => {
          const userId = this.WAITING_FOR_VERIFICATION.get(result.email);
          if (!userId) throw new Error('Failed to updated: userId not found');
          await this.updateStatus(userId, result.email, result);
        })
      ),
      `[${this.constructor.name}.verifyEmails]: Updating email status post verification`
    );

    this.logVerificationCompleted(results.length, verifierName, startTime);

    return results;
  }

  private async verificationPromises(
    verifiers: [EmailVerifierType, [EmailStatusVerifier, string[]]][]
  ) {
    return verifiers.map(async ([verifierName, [verifier, emails]]) => {
      const batches = EmailVerificationHandler.createEmailVerificationBatches(
        emails,
        verifier.emailsQuota / 10,
        verifierName,
        verifier
      );

      logRejectedAndReturnResolved(
        await Promise.allSettled(
          batches.map(async ([engine, engineName, emailBatch]) => {
            const verified = await this.verifyEmails(
              emailBatch,
              engine,
              engineName
            );
            await this.progressCallback(verified.length);
          })
        ),
        'Email verification failed'
      );
    });
  }

  async verify() {
    await this.getUpdateStatusCache();

    const verifiers = Array.from(
      this.emailStatusVerifier.getEmailVerifiers(
        Array.from(this.WAITING_FOR_VERIFICATION.keys())
      )
    );
    await Promise.allSettled([this.verificationPromises(verifiers)]);
  }
}

export default function initializeEmailVerificationProcessor(
  contacts: Contacts,
  emailStatusCache: EmailStatusCache,
  emailStatusVerifier: EmailStatusVerifierFactory
) {
  return {
    processStreamData: async (
      message: EmailVerificationData[],
      progressCallback: (verified: number) => Promise<void>
    ) => {
      const handler = new EmailVerificationHandler(
        contacts,
        emailStatusCache,
        emailStatusVerifier,
        progressCallback,
        logger,
        message
      );

      await handler.verify();
    }
  };
}
