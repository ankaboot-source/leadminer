import './env';

import ENV from './config';
import pool from './db/pg';
import PgContacts from './db/pg/PgContacts';
import ReacherEmailStatusVerifier from './services/email-status/reacher';
import ReacherClient from './services/email-status/reacher/client';
import { REDIS_PUBSUB_COMMUNICATION_CHANNEL } from './utils/constants';
import logger from './utils/logger';
import redis from './utils/redis';
import StreamConsumer from './workers/StreamConsumer';
import initializeMessageProcessor from './workers/handlers';

const redisSubscriber = redis.getSubscriberClient();
const redisClient = redis.getClient();

const contacts = new PgContacts(pool, logger);

const reacherClient = new ReacherClient(logger, {
  host: ENV.REACHER_HOST,
  apiKey: ENV.REACHER_API_KEY,
  headerSecret: ENV.REACHER_HEADER_SECRET
});
const emailStatusVerifier = new ReacherEmailStatusVerifier(
  reacherClient,
  logger
);

const { processStreamData } = initializeMessageProcessor(
  contacts,
  emailStatusVerifier
);

const streamConsumerInstance = new StreamConsumer(
  REDIS_PUBSUB_COMMUNICATION_CHANNEL,
  `consumer-${process.env.HOSTNAME}`,
  ENV.REDIS_CONSUMER_BATCH_SIZE,
  processStreamData,
  redisSubscriber,
  redisClient,
  logger
);

(() => {
  streamConsumerInstance.start();
})();
