import './env';

import ENV from './config';
import pool from './db/pg';
import PgContacts from './db/pg/PgContacts';
import RedisEmailStatusCache from './services/cache/redis/RedisEmailStatusCache';
import { REDIS_PUBSUB_COMMUNICATION_CHANNEL } from './utils/constants';
import logger from './utils/logger';
import redis from './utils/redis';
import StreamConsumer from './workers/StreamConsumer';
import initializeMessageProcessor from './workers/handlers';

const redisSubscriber = redis.getSubscriberClient();
const redisClient = redis.getClient();

const contacts = new PgContacts(pool, logger);
const emailStatusCache = new RedisEmailStatusCache(redisClient);

const { processStreamData } = initializeMessageProcessor(
  contacts,
  emailStatusCache
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
