import './env';

import ENV from './config';
import logger from './utils/logger';
import RedisSubscriber from './utils/pubsub/redis/RedisSubscriber';
import redis from './utils/redis';
import RedisMultipleStreamsConsumer from './utils/streams/redis/RedisMultipleStreamsConsumer';
import initializeEmailSignatureProcessor, {
  EmailData
} from './workers/email-signature/handler';
import EmailSignatureConsumer, {
  PubSubMessage
} from './workers/email-signature/consumer';
import RedisEmailSignatureCache from './services/cache/redis/RedisEmailSignatureCache';
import supabaseClient from './utils/supabase';

const redisClient = redis.getClient();
const subscriberRedisClient = redis.getSubscriberClient();

const emailSignatureCache = new RedisEmailSignatureCache(redisClient);

const { processStreamData } = initializeEmailSignatureProcessor(
  supabaseClient,
  emailSignatureCache
);

const tasksManagementSubscriber = new RedisSubscriber<PubSubMessage>(
  subscriberRedisClient,
  logger,
  ENV.REDIS_PUBSUB_COMMUNICATION_CHANNEL
);

const signatureStreamsConsumer = new RedisMultipleStreamsConsumer<EmailData>(
  redisClient,
  logger,
  `consumer-${process.env.HOSTNAME}`,
  ENV.REDIS_SIGNATURE_STREAM_CONSUMER_GROUP
);

const emailsStreamConsumer = new EmailSignatureConsumer(
  tasksManagementSubscriber,
  signatureStreamsConsumer,
  ENV.REDIS_SIGNATURE_STREAM_NAME,
  ENV.REDIS_EMAIL_SIGNATURE_CONSUMER_BATCH_SIZE,
  processStreamData,
  redisClient,
  logger
);

(async () => {
  try {
    logger.info('Setting up Redis stream, group...');
    await redisClient.xgroup(
      'CREATE',
      ENV.REDIS_SIGNATURE_STREAM_NAME,
      ENV.REDIS_SIGNATURE_STREAM_CONSUMER_GROUP,
      '$',
      'MKSTREAM'
    );
    logger.info('Consumer group created.');
  } catch (err: unknown) {
    if ((err as Error)?.message?.includes('BUSYGROUP')) {
      logger.info('Consumer group already created');
    } else {
      logger.error('Failed to start consumer:', err);
      process.exit(1);
    }
  }
  emailsStreamConsumer.start();
})();
