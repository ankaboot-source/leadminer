import { Logger } from 'winston';
import { AxiosError } from 'axios';
import {
  EmailStatusResult,
  EmailStatusVerifier,
  Status
} from '../EmailStatusVerifier';
import MailerCheckClient from './client';
import mailerCheckResultToEmailStatusResultMapper from './mappers';
import ENV from '../../../config';
import { MAILERCHECK_ZEROBOUNCE_DOMAIN_REGEX } from '../../../utils/constants';

export default class MailerCheckEmailStatusVerifier
  implements EmailStatusVerifier
{
  readonly emailsQuota = ENV.EMAILS_QUOTA_MAILERCHECK;

  private static readonly MAX_FAILED_POLL_ATTEMPTS = 5;

  private static readonly JOB_POLL_INTERVAL_MS = 1500;

  constructor(
    private readonly mailerCheckClient: MailerCheckClient,
    private readonly logger: Logger
  ) {}

  // eslint-disable-next-line class-methods-use-this
  isEligibleEmail(email: string): boolean {
    return MAILERCHECK_ZEROBOUNCE_DOMAIN_REGEX.test(email);
  }

  async verify(email: string): Promise<EmailStatusResult> {
    try {
      const result = await this.mailerCheckClient.verifyEmail(email);
      return {
        email,
        ...mailerCheckResultToEmailStatusResultMapper(result)
      };
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 402) {
        throw new Error('Insufficient Credits.');
      }
      return {
        email,
        status: Status.UNKNOWN,
        details: { hasTimedOut: true, source: 'mailercheck' }
      };
    }
  }

  async verifyBulk(emails: string[]): Promise<EmailStatusResult[]> {
    try {
      const name = `leadminer-${Date.now().toString()}`;
      const listId = await this.mailerCheckClient.createList({
        emails,
        name
      });

      await this.mailerCheckClient.startListVerification(listId);
      await this.pollVerificationStatus(listId);

      const results = await this.mailerCheckClient.getListResults(
        listId,
        emails.length
      );

      return results.emails.map(({ address, result }) => ({
        email: address,
        ...mailerCheckResultToEmailStatusResultMapper(result)
      }));
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 402) {
        throw new Error('Insufficient Credits.');
      }
      return this.defaultBulkResults(emails);
    }
  }

  async verifyMany(emails: string[]): Promise<EmailStatusResult[]> {
    if (emails.length === 0) return [];

    const result =
      emails.length === 1
        ? [await this.verify(emails[0])]
        : await this.verifyBulk(emails);
    return result;
  }

  private async checkListStatus(listId: number): Promise<boolean | null> {
    try {
      const verificationStatus =
        await this.mailerCheckClient.getListStatus(listId);
      return verificationStatus === 'done' ? true : null;
    } catch (error) {
      this.logger.error(
        `Failed poll attempt for list verification with id: ${listId}`
      );
      return null;
    }
  }

  private pollVerificationStatus(listId: number) {
    return new Promise<boolean>((resolve) => {
      let failedSuccessivePollAttempts = 0;
      const interval = setInterval(async () => {
        const success = await this.checkListStatus(listId);
        if (success === false) {
          failedSuccessivePollAttempts = 0;
        } else if (success === true) {
          clearInterval(interval);
          resolve(true);
        } else {
          if (
            failedSuccessivePollAttempts ===
            MailerCheckEmailStatusVerifier.MAX_FAILED_POLL_ATTEMPTS
          ) {
            resolve(false);
          }
          failedSuccessivePollAttempts += 1;
        }
      }, MailerCheckEmailStatusVerifier.JOB_POLL_INTERVAL_MS);
    });
  }

  // eslint-disable-next-line class-methods-use-this
  private defaultBulkResults(emails: string[]) {
    return emails.map((email: string) => ({
      email,
      status: Status.UNKNOWN,
      details: {
        hasTimedOut: true,
        source: 'mailercheck' as const
      }
    }));
  }
}
