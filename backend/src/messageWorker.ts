import './env';

import { REDIS_CONSUMER_BATCH_SIZE } from './config';
import pool from './db/pg';
import PgContacts from './db/pg/PgContacts';
import { REDIS_PUBSUB_COMMUNICATION_CHANNEL } from './utils/constants';
import logger from './utils/logger';
import redis from './utils/redis';
import StreamConsumer from './workers/StreamConsumer';
import initializeMessageProcessor from './workers/handlers';

const redisSubscriber = redis.getSubscriberClient();
const redisClient = redis.getClient();

const contacts = new PgContacts(pool, logger);

const { processStreamData } = initializeMessageProcessor(contacts);

const streamConsumerInstance = new StreamConsumer(
  REDIS_PUBSUB_COMMUNICATION_CHANNEL,
  `consumer-${process.env.HOSTNAME}`,
  REDIS_CONSUMER_BATCH_SIZE,
  processStreamData,
  redisSubscriber,
  redisClient,
  logger
);

(() => {
  streamConsumerInstance.start();
})();
