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
import { Signature } from './services/signature';
import { LLMModels } from './services/signature/llm';
import { checkDomainStatus } from './utils/helpers/domainHelpers';
import { TokenBucketRateLimiter } from './services/rate-limiter/RateLimiter';

const redisClient = redis.getClient();
const subscriberRedisClient = redis.getSubscriberClient();

const emailSignatureCache = new RedisEmailSignatureCache(redisClient);

const llmModel = LLMModels.cohere;

const { processStreamData } = initializeEmailSignatureProcessor(
  supabaseClient,
  new Signature(
    new TokenBucketRateLimiter(llmModel.includes('free') ? 15 : 500, 60 * 1000),
    logger,
    {
      model: llmModel,
      apiKey: ENV.SIGNATURE_OPENROUTER_API_KEY,
      useLLM: ENV.SIGNATURE_USE_LLM
    }
  ),
  emailSignatureCache,
  checkDomainStatus,
  redisClient
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
