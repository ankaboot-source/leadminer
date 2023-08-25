import { Job, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { Logger } from 'winston';
import { Contacts } from '../db/interfaces/Contacts';
import {
  EmailStatusVerifier,
  Status
} from '../services/email-status/EmailStatusVerifier';
import { REDIS_EMAIL_STATUS_KEY } from '../utils/constants';

export default function initializeEmailVerificationWorker(
  miningId: string,
  redis: Redis,
  logger: Logger,
  contacts: Contacts,
  emailStatusVerifier: EmailStatusVerifier
) {
  const abortController = new AbortController();

  const worker = new Worker<{ email: string; userId: string }, void, string>(
    miningId,
    async (job: Job<{ email: string; userId: string }, void, string>) => {
      try {
        const { userId, email } = job.data;

        const { status } = await emailStatusVerifier.verify(
          email,
          abortController.signal
        );

        await redis.hset(REDIS_EMAIL_STATUS_KEY, email, status);

        if (status !== Status.UNKNOWN) {
          await contacts.updatePersonStatus(email, userId, status);
        }
      } catch (error) {
        logger.error('error', error);
      }
    },
    {
      connection: redis,
      autorun: false
    }
  );

  worker.on('closing', () => {
    logger.info('Closing email verification worker');
    abortController.abort();
  });

  worker.on('error', (err) => {
    logger.error('Email verification worker error', err);
  });

  worker.on('failed', (_job, error: Error) => {
    logger.error('error', error);
  });

  return worker;
}
