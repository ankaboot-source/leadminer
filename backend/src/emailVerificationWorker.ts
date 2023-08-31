import './env';

import ENV from './config';
import pool from './db/pg';
import PgContacts from './db/pg/PgContacts';
import RedisEmailStatusCache from './services/cache/redis/RedisEmailStatusCache';
import EmailStatusVerifierFactory from './services/email-status/EmailStatusVerifierFactory';
import EmailVerificationWorker from './services/email-status/EmailVerificationWorker';
import { REDIS_EMAIL_VERIFICATION_QUEUE as EMAIL_VERIFICATION_QUEUE_NAME } from './utils/constants';
import logger from './utils/logger';
import redis from './utils/redis';

const emailStatusVerifier = EmailStatusVerifierFactory.create(ENV, logger);
const emailStatusCache = new RedisEmailStatusCache(redis.getClient());
const contacts = new PgContacts(pool, logger);

const worker = new EmailVerificationWorker(
  redis.getClient(),
  logger,
  contacts,
  emailStatusVerifier,
  emailStatusCache,
  EMAIL_VERIFICATION_QUEUE_NAME
);

worker.run();
