import axios from 'axios';
import { Logger } from 'winston';
import { chunkGenerator } from '../../../utils/array';
import {
  EmailStatusResult,
  EmailStatusVerifier,
  Status
} from '../EmailStatusVerifier';
import ReacherClient from './client';
import { reacherResultToEmailStatusWithDetails } from './mappers';
import ENV from '../../../config';
import { MAILERCHECK_ZEROBOUNCE_DOMAIN_REGEX } from '../../../utils/constants';

export default class ReacherEmailStatusVerifier implements EmailStatusVerifier {
  private static readonly JOB_POLL_INTERVAL_MS = 1000;

  private static readonly MAX_FAILED_POLL_ATTEMPTS = 3;

  private static readonly MAX_CHUNK_SIZE = 150;

  readonly emailsQuota = ENV.EMAILS_QUOTA_REACHER;

  constructor(
    private readonly reacherClient: ReacherClient,
    private readonly logger: Logger
  ) {}

  // eslint-disable-next-line class-methods-use-this
  isEligibleEmail(email: string): boolean {
    return MAILERCHECK_ZEROBOUNCE_DOMAIN_REGEX.test(email) === false;
  }

  async verify(
    email: string,
    abortSignal?: AbortSignal
  ): Promise<EmailStatusResult> {
    try {
      const data = await this.reacherClient.checkSingleEmail(
        email,
        abortSignal
      );

      return reacherResultToEmailStatusWithDetails(data);
    } catch (error) {
      const result: EmailStatusResult = {
        email,
        status: Status.UNKNOWN
      };
      if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
        result.details = { hasTimedOut: true };
      }
      return result;
    }
  }

  async verifyMany(
    emails: string[],
    abortSignal?: AbortSignal
  ): Promise<EmailStatusResult[]> {
    if (emails.length === 0) {
      return [];
    }

    if (emails.length === 1) {
      const result = await this.verify(emails[0], abortSignal);
      return [result];
    }

    const fn = async (emailsChunk: string[]) => {
      try {
        const startedAt = performance.now();
        const jobSubmitData =
          await this.reacherClient.createBulkVerificationJob(emailsChunk);

        const jobId = jobSubmitData.job_id;

        const jobSuccess = await this.pollJobStatus(jobId);

        if (!jobSuccess) {
          this.logger.error('Failed bulk email verification job', { jobId });
          return this.defaultBulkResults(emails);
        }

        const jobResults = await this.reacherClient.getResults(jobId);
        this.logger.info(
          `Successful verification job took ${(
            (performance.now() - startedAt) /
            1000
          ).toFixed(2)} seconds`,
          { jobId, count: emails.length }
        );

        return jobResults.results.map((r) =>
          reacherResultToEmailStatusWithDetails(r)
        );
      } catch (error) {
        this.logger.error('Failed processing bulk verification job');
        return this.defaultBulkResults(emailsChunk);
      }
    };

    if (emails.length > ReacherEmailStatusVerifier.MAX_CHUNK_SIZE) {
      const promises = [];

      const chunkIterator = chunkGenerator(
        emails,
        ReacherEmailStatusVerifier.MAX_CHUNK_SIZE
      );

      for (const chunk of chunkIterator) {
        promises.push(fn(chunk));
      }
      return (await Promise.all(promises)).flat();
    }

    return fn(emails);
  }

  private pollJobStatus(jobId: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let failedSuccessivePollAttempts = 0;
      const interval = setInterval(async () => {
        try {
          const data = await this.reacherClient.getJobStatus(jobId);
          failedSuccessivePollAttempts = 0;
          if (data?.job_status === 'Completed') {
            clearInterval(interval);
            resolve(true);
          }
        } catch (error) {
          if (
            failedSuccessivePollAttempts ===
            ReacherEmailStatusVerifier.MAX_FAILED_POLL_ATTEMPTS
          ) {
            this.logger.error(
              `${
                ReacherEmailStatusVerifier.MAX_FAILED_POLL_ATTEMPTS
              } Failed poll attempts for job status: ${
                error instanceof Error ? error.message : ''
              }`
            );
            resolve(false);
          }
          failedSuccessivePollAttempts += 1;
        }
      }, ReacherEmailStatusVerifier.JOB_POLL_INTERVAL_MS);
    });
  }

  // eslint-disable-next-line class-methods-use-this
  private defaultBulkResults(emails: string[]) {
    return emails.map((e: string) => ({
      email: e,
      status: Status.UNKNOWN,
      details: {
        hasTimedOut: true,
        source: 'reacher' as const
      }
    }));
  }
}
