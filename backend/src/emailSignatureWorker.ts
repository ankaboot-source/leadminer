import './env';

import ENV from './config';
import logger from './utils/logger';
import RedisSubscriber from './utils/pubsub/redis/RedisSubscriber';
import redis from './utils/redis';
import RedisMultipleStreamsConsumer from './utils/streams/redis/RedisMultipleStreamsConsumer';
import initializeEmailSignatureProcessor, {
  EmailData
} from './workers/email-signature/handler';
import EmailSignatureConsumer from './workers/email-signature/consumer';
import { StreamCommand } from './workers/types';
import RedisEmailSignatureCache from './services/cache/redis/RedisEmailSignatureCache';
import supabaseClient from './utils/supabase';
import { EngineConfig, Signature } from './services/signature';
import { SignatureLLM } from './services/signature/llm';
import SignatureExtractorCache from './services/signature/llm/signature-extractor-cache';
import { checkDomainStatus } from './utils/helpers/domainHelpers';
import { Distribution, TokenBucketRateLimiter } from './services/rate-limiter';
import { SignatureRE } from './services/signature/regex';
import { LLMModelsList } from './services/signature/llm/types';

const redisClient = redis.getClient();
const subscriberRedisClient = redis.getSubscriberClient();

const emailSignatureCache = new RedisEmailSignatureCache(redisClient);

const signatureEngines: EngineConfig[] = [
  {
    engine: new SignatureRE(logger),
    useAsFallback: true
  }
];

if (ENV.SIGNATURE_OPENROUTER_API_KEY) {
  const signatureLLM = new SignatureLLM(
    new TokenBucketRateLimiter({
      executeEvenly: false,
      intervalSeconds: 60,
      uniqueKey: 'email-signature-service',
      distribution: Distribution.Memory,
      requests: LLMModelsList.every((m) => m.includes('free')) ? 15 : 1000
    }),
    logger,
    LLMModelsList,
    ENV.SIGNATURE_OPENROUTER_API_KEY ?? ''
  );

  const signatureExtractorCache = new SignatureExtractorCache(
    signatureLLM,
    redisClient,
    logger,
    ENV.SIGNATURE_LLM_CACHE_TTL_SECONDS ?? 86400
  );

  signatureEngines.push({
    engine: signatureExtractorCache,
    useAsFallback: false
  });
}

const { processStreamData, handler } = initializeEmailSignatureProcessor(
  supabaseClient,
  new Signature(logger, signatureEngines),
  emailSignatureCache,
  checkDomainStatus,
  redisClient
);

const tasksManagementSubscriber = new RedisSubscriber<StreamCommand>(
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
  logger,
  handler
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
      // skipcq: JS-0263 - Intentional: worker must terminate on startup failure, cannot recover
      process.exit(1);
    }
  }
  emailsStreamConsumer.start();
})();
