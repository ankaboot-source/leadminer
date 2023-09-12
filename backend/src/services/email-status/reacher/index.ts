import { Logger } from 'winston';
import { chunkGenerator } from '../../../utils/array';
import {
  EmailStatusResult,
  EmailStatusVerifier,
  Status
} from '../EmailStatusVerifier';
import ReacherClient from './client';
import { reacherResultToEmailStatusWithDetails } from './mappers';

export default class ReacherEmailStatusVerifier implements EmailStatusVerifier {
  private static readonly JOB_POLL_INTERVAL_MS = 1000;

  private static readonly MAX_FAILED_POLL_ATTEMPTS = 3;

  private static readonly MAX_CHUNK_SIZE = 150;

  constructor(
    private readonly reacherClient: ReacherClient,
    private readonly logger: Logger
  ) {}

  async verify(
    email: string,
    abortSignal?: AbortSignal
  ): Promise<EmailStatusResult> {
    try {
      const { data, error } = await this.reacherClient.checkSingleEmail(
        email,
        abortSignal
      );
      if (error && !data) {
        return {
          email,
          status: Status.UNKNOWN,
          details: {
            hasTimedOut: true
          }
        };
      }

      return reacherResultToEmailStatusWithDetails(data);
    } catch (error) {
      return {
        email,
        status: Status.UNKNOWN,
        details: {
          hasTimedOut: true
        }
      };
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
      const startedAt = performance.now();
      const { data: jobSubmitData, error: jobSubmitError } =
        await this.reacherClient.createBulkVerificationJob(emailsChunk);

      if (jobSubmitError && !jobSubmitData) {
        this.logger.error(
          'Failed creating bulk verification job',
          jobSubmitError
        );
        return this.defaultBulkResults(emailsChunk);
      }

      const jobId = jobSubmitData.job_id;

      const jobSuccess = await this.pollJobStatus(jobId);

      if (!jobSuccess) {
        this.logger.error('Failed bulk email verification job', { jobId });
        return this.defaultBulkResults(emails);
      }

      const { data: jobResults } = await this.reacherClient.getResults(jobId);
      if (jobResults) {
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
      }

      this.logger.info('No verification job results', { jobId });
      return this.defaultBulkResults(emailsChunk);
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
          const { data, error } = await this.reacherClient.getJobStatus(jobId);

          if (error) {
            if (
              failedSuccessivePollAttempts ===
              ReacherEmailStatusVerifier.MAX_FAILED_POLL_ATTEMPTS
            ) {
              this.logger.error(
                `${ReacherEmailStatusVerifier.MAX_FAILED_POLL_ATTEMPTS} Failed poll attempts for job status`,
                error
              );
              resolve(false);
            }
            failedSuccessivePollAttempts += 1;
            return;
          }

          failedSuccessivePollAttempts = 0;

          if (data?.job_status === 'Completed') {
            clearInterval(interval);
            resolve(true);
          }
        } catch (error) {
          resolve(false);
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
        hasTimedOut: true
      }
    }));
  }
}
