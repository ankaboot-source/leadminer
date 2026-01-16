import './env';

import ENV from './config';
import pool from './db/pg';
import PgContacts from './db/pg/PgContacts';
import RedisEmailStatusCache from './services/cache/redis/RedisEmailStatusCache';
import EmailStatusVerifierFactory from './services/email-status/EmailStatusVerifierFactory';
import logger from './utils/logger';
import RedisSubscriber from './utils/pubsub/redis/RedisSubscriber';
import redis from './utils/redis';
import RedisMultipleStreamsConsumer from './utils/streams/redis/RedisMultipleStreamsConsumer';
import EmailVerificationConsumer, {
  PubSubMessage
} from './workers/email-verification/EmailsVerificationConsumer';
import initializeEmailVerificationProcessor, {
  EmailVerificationData
} from './workers/email-verification/emailVerificationHandlers';

const redisClient = redis.getClient();
const subscriberRedisClient = redis.getSubscriberClient();

const emailStatusVerifier = new EmailStatusVerifierFactory(ENV, logger);
const emailStatusCache = new RedisEmailStatusCache(redisClient);
const contacts = new PgContacts(pool, logger);

const streamsHandler = initializeEmailVerificationProcessor(
  contacts,
  emailStatusCache,
  emailStatusVerifier,
  redisClient,
  logger
);

const tasksManagementSubscriber = new RedisSubscriber<PubSubMessage>(
  subscriberRedisClient,
  logger,
  ENV.REDIS_PUBSUB_COMMUNICATION_CHANNEL
);

const emailStreamsConsumer =
  new RedisMultipleStreamsConsumer<EmailVerificationData>(
    redisClient,
    logger,
    `consumer-${process.env.HOSTNAME}`,
    ENV.REDIS_CLEANING_STREAM_CONSUMER_GROUP
  );

const emailsStreamConsumer = new EmailVerificationConsumer(
  tasksManagementSubscriber,
  emailStreamsConsumer,
  ENV.REDIS_EMAIL_VERIFICATION_CONSUMER_BATCH_SIZE,
  streamsHandler,
  redisClient,
  logger
);

(() => {
  emailsStreamConsumer.start();
})();
