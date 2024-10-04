import './env';

import ENV from './config';
import pool from './db/pg';
import PgContacts from './db/pg/PgContacts';
import RedisEmailStatusCache from './services/cache/redis/RedisEmailStatusCache';
import EmailStatusVerifierFactory from './services/email-status/EmailStatusVerifierFactory';
import {
  EMAILS_STREAM_CONSUMER_GROUP,
  REDIS_PUBSUB_COMMUNICATION_CHANNEL
} from './utils/constants';
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

const { processStreamData } = initializeEmailVerificationProcessor(
  contacts,
  emailStatusCache,
  emailStatusVerifier
);

const tasksManagementSubscriber = new RedisSubscriber<PubSubMessage>(
  subscriberRedisClient,
  logger,
  REDIS_PUBSUB_COMMUNICATION_CHANNEL
);

const emailStreamsConsumer =
  new RedisMultipleStreamsConsumer<EmailVerificationData>(
    redisClient,
    logger,
    `consumer-${process.env.HOSTNAME}`,
    EMAILS_STREAM_CONSUMER_GROUP
  );

const emailsStreamConsumer = new EmailVerificationConsumer(
  tasksManagementSubscriber,
  emailStreamsConsumer,
  ENV.REDIS_EMAIL_VERIFICATION_CONSUMER_BATCH_SIZE,
  processStreamData,
  redisClient,
  logger
);

(() => {
  emailsStreamConsumer.start();
})();
