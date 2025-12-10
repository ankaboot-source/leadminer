import { Logger } from 'winston';
import axios from 'axios';
import ZerobounceClient from './client';
import zerobounceResultToEmailStatusResultMapper from './mapper';
import {
  EmailStatusResult,
  EmailStatusVerifier,
  Status
} from '../EmailStatusVerifier';
import ENV from '../../../config';
import { MAILERCHECK_ZEROBOUNCE_DOMAIN_REGEX } from '../../../utils/constants';

export default class ZerobounceEmailStatusVerifier
  implements EmailStatusVerifier
{
  readonly emailsQuota = ENV.EMAILS_QUOTA_ZEROBOUNCE;

  constructor(
    private readonly client: ZerobounceClient,
    private readonly logger: Logger
  ) {}

  // eslint-disable-next-line class-methods-use-this
  isEligibleEmail(email: string): boolean {
    return MAILERCHECK_ZEROBOUNCE_DOMAIN_REGEX.test(email);
  }

  async verify(email: string): Promise<EmailStatusResult> {
    try {
      const result = await this.client.verifyEmail({
        email_address: email,
        ip_address: ''
      });

      if (result?.error) {
        throw new Error('Insufficient Credits.');
      }

      return {
        email,
        ...zerobounceResultToEmailStatusResultMapper(result)
      };
    } catch (error) {
      // if (axios.isAxiosError(error) && error.response?.status === 429) {
      //   throw new Error('API rate limit exceeded');
      // }

      // if (error instanceof Error && error.message === 'Insufficient Credits.') {
      //   throw error;
      // }

      return {
        email,
        status: Status.UNKNOWN,
        details: { hasTimedOut: true, source: 'zerobounce' }
      };
    }
  }

  async verifyMany(emails: string[]): Promise<EmailStatusResult[]> {
    const batchSize = ZerobounceClient.BATCH_VALIDATION_LENGTH;

    const formatEmails = emails.map((email) => ({
      email_address: email,
      ip_address: null
    }));

    const batches = [];

    for (let i = 0; i < formatEmails.length; i += batchSize) {
      batches.push(formatEmails.slice(i, i + batchSize));
    }

    const results = await Promise.all(
      batches.map(async (batch) => {
        try {
          const response = await this.client.verifyEmailBulk(batch);
          if (
            response.errors &&
            response.errors[0].error ===
              'Invalid API Key or your account ran out of credits'
          ) {
            throw new Error('Insufficient Credits.');
          }

          return response.email_batch.map((emailResult) => ({
            email: emailResult.address,
            ...zerobounceResultToEmailStatusResultMapper(emailResult)
          }));
        } catch (error) {
          if (axios.isAxiosError(error) && error.response?.status === 429) {
            throw new Error('API rate limit exceeded');
          }

          if (
            error instanceof Error &&
            error.message === 'Insufficient Credits.'
          ) {
            throw error;
          }
          return this.defaultBulkResults(
            batch.map((emailObj) => emailObj.email_address)
          );
        }
      })
    );

    // Flatten the results array
    return results.flat();
  }

  // eslint-disable-next-line class-methods-use-this
  private defaultBulkResults(emails: string[]) {
    return emails.map((e: string) => ({
      email: e,
      status: Status.UNKNOWN,
      details: {
        hasTimedOut: true,
        source: 'zerobounce' as const
      }
    }));
  }
}
