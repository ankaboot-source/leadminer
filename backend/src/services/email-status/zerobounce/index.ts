import { Logger } from 'winston';
import ZerobounceClient from './client';
import zerobounceResultToEmailStatusResultMapper from './mapper';
import {
  EmailStatusResult,
  EmailStatusVerifier,
  Status
} from '../EmailStatusVerifier';

export default class ZerobounceEmailStatusVerifier
  implements EmailStatusVerifier
{
  constructor(
    private readonly client: ZerobounceClient,
    private readonly logger: Logger
  ) {}

  async verify(email: string): Promise<EmailStatusResult> {
    try {
      const result = await this.client.verifyEmail({
        email_address: email,
        ip_address: ''
      });
      return {
        email,
        ...zerobounceResultToEmailStatusResultMapper(result)
      };
    } catch (error) {
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
          return response.email_batch.map((emailResult) => ({
            email: emailResult.address,
            ...zerobounceResultToEmailStatusResultMapper(emailResult)
          }));
        } catch (error) {
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
