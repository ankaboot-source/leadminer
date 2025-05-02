import './env';

import ENV from './config';
import pool from './db/pg';
import PgContacts from './db/pg/PgContacts';
import logger from './utils/logger';
import RedisSubscriber from './utils/pubsub/redis/RedisSubscriber';
import redis from './utils/redis';
import RedisMultipleStreamsConsumer from './utils/streams/redis/RedisMultipleStreamsConsumer';
import initializeEmailSignatureProcessor, {
  EmailSignatureData
} from './workers/email-signature/handler';
import EmailSignatureConsumer, {
  PubSubMessage
} from './workers/email-signature/consumer';
import RedisEmailSignatureCache from './services/cache/redis/RedisEmailSignatureCache';

const redisClient = redis.getClient();
const subscriberRedisClient = redis.getSubscriberClient();

const contacts = new PgContacts(pool, logger);

const emailSignatureCache = new RedisEmailSignatureCache(redisClient);

const { processStreamData } = initializeEmailSignatureProcessor(
  contacts,
  emailSignatureCache
);

const tasksManagementSubscriber = new RedisSubscriber<PubSubMessage>(
  subscriberRedisClient,
  logger,
  ENV.REDIS_PUBSUB_COMMUNICATION_CHANNEL
);

const signatureStreamsConsumer =
  new RedisMultipleStreamsConsumer<EmailSignatureData>(
    redisClient,
    logger,
    `consumer-${process.env.HOSTNAME}`,
    ENV.REDIS_SIGNATURE_STREAM_CONSUMER_GROUP
  );

const emailsStreamConsumer = new EmailSignatureConsumer(
  tasksManagementSubscriber,
  signatureStreamsConsumer,
  ENV.REDIS_EMAIL_SIGNATURE_CONSUMER_BATCH_SIZE,
  processStreamData,
  redisClient,
  logger
);

(() => {
  emailsStreamConsumer.start();
})();
