import './env';

import ENV from './config';
import pool from './db/pg';
import PgContacts from './db/pg/PgContacts';
import RedisEmailStatusCache from './services/cache/redis/RedisEmailStatusCache';
import {
  MESSAGES_STREAM_CONSUMER_GROUP,
  REDIS_PUBSUB_COMMUNICATION_CHANNEL
} from './utils/constants';
import logger from './utils/logger';
import RedisSubscriber from './utils/pubsub/redis/RedisSubscriber';
import redis from './utils/redis';
import RedisMultipleStreamsConsumer from './utils/streams/redis/RedisMultipleStreamsConsumer';
import MessagesStreamConsumer, {
  PubSubMessage
} from './workers/MessagesStreamConsumer';
import initializeEmailMessageProcessor, {
  EmailMessageData
} from './workers/handlers';

const subscriberRedisClient = redis.getSubscriberClient();
const redisClient = redis.getClient();

const contacts = new PgContacts(pool, logger);
const emailStatusCache = new RedisEmailStatusCache(redisClient);

const { processStreamData } = initializeEmailMessageProcessor(
  contacts,
  emailStatusCache
);

const tasksManagementSubscriber = new RedisSubscriber<PubSubMessage>(
  subscriberRedisClient,
  logger,
  REDIS_PUBSUB_COMMUNICATION_CHANNEL
);

const messagesStreamsConsumer =
  new RedisMultipleStreamsConsumer<EmailMessageData>(
    redisClient,
    logger,
    `consumer-${process.env.HOSTNAME}`,
    MESSAGES_STREAM_CONSUMER_GROUP
  );

const streamConsumerInstance = new MessagesStreamConsumer(
  tasksManagementSubscriber,
  messagesStreamsConsumer,
  ENV.REDIS_CONSUMER_BATCH_SIZE,
  processStreamData,
  redisClient,
  logger
);

(() => {
  streamConsumerInstance.start();
})();
