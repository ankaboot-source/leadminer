import '../../env';

import ENV from '../../config';
import logger from '../../utils/logger';
import redis from '../../utils/redis';
import RedisSubscriber from '../../utils/pubsub/redis/RedisSubscriber';
import PostgreSQLImportWorker, {
  PubSubMessage
} from './PostgreSQLImportWorker';

const WORKER_NAME = 'postgresql-import-worker';
const BATCH_SIZE = 100;

async function startWorker() {
  logger.info(`${WORKER_NAME} initializing...`);

  const redisClient = redis.getClient();
  const redisSubscriber = redis.getSubscriberClient();

  const taskManagementSubscriber = new RedisSubscriber<PubSubMessage>(
    redisSubscriber,
    logger,
    ENV.REDIS_PUBSUB_COMMUNICATION_CHANNEL
  );

  const worker = new PostgreSQLImportWorker(
    taskManagementSubscriber,
    redisClient,
    logger,
    BATCH_SIZE
  );

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    worker.stop();
    await taskManagementSubscriber.unsubscribe();
    logger.info(`${WORKER_NAME} shut down complete`);
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error);
    shutdown('uncaughtException').catch((err) => {
      logger.error('Error during shutdown', err);
      process.exit(1);
    });
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', reason);
  });

  // Start the worker
  worker.start();
  logger.info(`${WORKER_NAME} started and ready to process PostgreSQL imports`);
}

startWorker().catch((error) => {
  logger.error('Failed to start worker', error);
  process.exit(1);
});
