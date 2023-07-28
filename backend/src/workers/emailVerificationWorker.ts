import { Job, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { Logger } from 'winston';
import { Contacts } from '../db/Contacts';
import { EmailStatusVerifier } from '../services/email-status/EmailStatusVerifier';

export default function initializeEmailVerificationWorker(
  redis: Redis,
  logger: Logger,
  contacts: Contacts,
  emailStatusVerifier: EmailStatusVerifier
) {
  const abortController = new AbortController();
  const worker = new Worker<{ email: string; userId: string }, string, string>(
    'EmailVerifier',
    async (job: Job<{ email: string; userId: string }, string, string>) => {
      const { userId, email } = job.data;

      const { status } = await emailStatusVerifier.verify(email);
      await contacts.updatePersonStatus(email, userId, status);

      return '';
    },
    {
      connection: redis,
      autorun: false
    }
  );

  worker.on('closing', () => abortController.abort());

  worker.on('error', (err) => {
    logger.error('Email verification worker error', err);
  });

  return worker;
}
