import { Job, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { Logger } from 'winston';
import { Contacts } from '../../db/interfaces/Contacts';
import EmailStatusCache from '../cache/EmailStatusCache';
import { EmailStatusVerifier } from './EmailStatusVerifier';
import { EmailVerificationJobData } from './types';

interface Options {
  EMAIL_VERIFICATION_QUEUE_NAME: string;
  CONCURRENCY_FACTOR: number;
}

export default class EmailVerificationWorker {
  private readonly worker: Worker<EmailVerificationJobData, void, string>;

  constructor(
    private readonly redisClient: Redis,
    private readonly logger: Logger,
    private readonly contacts: Contacts,
    private readonly emailStatusVerifier: EmailStatusVerifier,
    private readonly emailStatusCache: EmailStatusCache,
    { EMAIL_VERIFICATION_QUEUE_NAME, CONCURRENCY_FACTOR }: Options
  ) {
    this.worker = new Worker<EmailVerificationJobData, void, string>(
      EMAIL_VERIFICATION_QUEUE_NAME,
      (job) => this.jobHandler(job),
      {
        concurrency: CONCURRENCY_FACTOR,
        connection: this.redisClient,
        autorun: false
      }
    );

    this.registerEventHandlers();
  }

  private async jobHandler(job: Job<EmailVerificationJobData, void, string>) {
    const { userId, email } = job.data;

    this.logger.debug('Requested verification', { userId, email });

    try {
      const cacheResult = await this.emailStatusCache.get(email);
      if (!cacheResult) {
        const { status } = await this.emailStatusVerifier.verify(email);
        this.logger.debug('Got verification result from reacher', {
          status,
          email
        });
        await Promise.allSettled([
          this.emailStatusCache.set(email, status),
          this.contacts.updateSinglePersonStatus(email, userId, status)
        ]);
      }
    } catch (error) {
      this.logger.error('Error when handling email verification job', error);
    }
  }

  private registerEventHandlers() {
    this.worker.on('closing', () => {
      this.logger.info('Closing email verification worker');
    });

    this.worker.on('error', (err) => {
      this.logger.error('Email verification worker error', err);
    });

    this.worker.on('failed', (_job, error: Error) => {
      this.logger.error('error', error);
    });
  }

  run() {
    return this.worker.run();
  }
}
