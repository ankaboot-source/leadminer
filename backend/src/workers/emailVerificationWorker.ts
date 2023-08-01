import { Job, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { Logger } from 'winston';
import { Contacts } from '../db/Contacts';
import {
  EmailStatusResult,
  EmailStatusVerifier,
  Status
} from '../services/email-status/EmailStatusVerifier';
import { REDIS_EMAIL_STATUS_KEY } from '../utils/constants';
import rejectAfter from '../utils/profiling/timeout';

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
      const { userId, email } = job.data;

      logger.debug('Requested verification', { userId, email });

      try {
        let status: Status;

        const cacheResult = await redis.hget(REDIS_EMAIL_STATUS_KEY, email);
        if (cacheResult) {
          status = cacheResult as Status;
        } else {
          const reacherResult = (await Promise.race([
            emailStatusVerifier.verify(email, abortController.signal),
            rejectAfter(2000)
          ])) as EmailStatusResult;
          logger.debug('Got verification result', reacherResult);
          await redis.hset(REDIS_EMAIL_STATUS_KEY, email, reacherResult.status);
          status = reacherResult.status;
        }
        await contacts.updatePersonStatus(email, userId, status);
        logger.debug('Inserted verification result');
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
