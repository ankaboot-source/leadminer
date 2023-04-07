const { logger } = require('../utils/logger');
const { redis } = require('../utils/redis');
const { processStreamData } = require('./handlers');
const { REDIS_CONSUMER_BATCH_SIZE } = require('../config');
const redisSubscriber = redis.getSubscriberClient();
const redisClient = redis.getClient();

const { REDIS_PUBSUB_COMMUNICATION_CHANNEL } = require('../utils/constants');

class StreamConsumer {
  /**
   * Creates an instance of StreamConsumer.
   * @param {string} pubsubCommunicationChannel - Redis pub/sub channel used for receiving configuration and commands.
   * @param {string} consumerName - The name of this consumer.
   * @param {number} batchSize - The number of messages to be processed in each batch.
   * @param {function} messageProcessor - The function that will process the messages consumed from the stream.
   */
  constructor(
    pubsubCommunicationChannel,
    consumerName,
    batchSize,
    messageProcessor
  ) {
    this.pubsubCommunicationChannel = pubsubCommunicationChannel;
    this.messageProcessor = messageProcessor;
    this.consumerName = consumerName;
    this.batchSize = batchSize;
    this.isInterrupted = true;

    this.streamsRegistry = new Map();

    // Subscribe to the Redis channel for stream management.
    redisSubscriber.subscribe(pubsubCommunicationChannel, (err) => {
      if (err) {
        logger.error('Failed subscribing to Redis.', { metadata: { err } });
      }
    });

    redisSubscriber.on('message', (_, data) => {
      const { miningId, command, streamName, consumerGroupName } =
        JSON.parse(data);

      if (command === 'REGISTER') {
        this.streamsRegistry.set(miningId, { streamName, consumerGroupName });
      } else {
        this.streamsRegistry.delete(miningId);
      }

      // Log the received PubSub signal for debugging purposes.
      logger.debug('Received PubSub signal.', {
        metadata: {
          miningId,
          command,
          streamName,
          consumerGroupName
        }
      });
    });
  }

  /**
   * Continuously consumes messages from a Redis stream, processes them and updates the last read message ID
   * @param {string[]} streams - The name of the Redis stream to consume messages from
   * @param {string} consumerGroupName - The name of the Redis consumer group to read from
   * @returns {Promise} - A Promise that resolves when the stream is consumed successfully, or rejects with an error
   */
  async consumeFromStreams(streams, consumerGroupName) {
    try {
      const result = await redisClient.xreadgroup(
        'GROUP',
        consumerGroupName,
        this.consumerName,
        'COUNT',
        this.batchSize,
        'BLOCK',
        2000,
        'STREAMS',
        [...streams.map((name) => name)],
        [...streams.map(() => '>')]
      );

      if (result === null) {
        return null;
      }

      const processedData = await Promise.allSettled(result.map(async ([streamName, streamMessages]) => {
        /**
         * This code processes messages from multiple streams in parallel. 
         * For each stream, it executes the messageProcessor functions on each message in parallel.
         * It then acknowledges the messages that were processed and publishes the extraction progress.
         * Finally, it trims the stream to remove the processed messages.
         *  
         * Returns:
         * - An array of Promises that resolve to the processed messages for each stream
         */
        const messageIds = streamMessages.map(([id]) => id);
        const lastMessageId = messageIds.slice(-1)[0];
        try {
          const startTime = performance.now();
          const promises = await Promise.allSettled(streamMessages.map((message) => this.messageProcessor(message)));
          const endTime = performance.now();
          const miningId = promises[0].value;
          const extractionProgress = {
            miningId,
            progressType: 'extracted',
            count: promises.length
          };

          // Logs the time taken for extraction
          logger.debug(`Extraction of ${messageIds.length} messages took ${endTime - startTime}ms`);

          // Acknowledges the messages that were processed
          redisClient.xack(streamName, consumerGroupName, ...messageIds);

          // Publishes the extraction progress
          redisClient.publish(miningId, JSON.stringify(extractionProgress));

          // Logs the progress being published
          logger.debug('Publishing progress from worker', {
            metadata: {
              details: {
                miningId,
                pubsubChannel: streamName,
                consumerGroupName,
                consumerName: this.consumerName,
                extractionProgress
              }
            }
          });

          // Trims the stream to remove the processed messages
          redisClient.xtrim(streamName, 'MINID', lastMessageId);
          return promises;
        } catch (err) {
          return Promise.reject(err);
        }
      }));

      const failedExtractions = processedData.filter(p => p.status === 'rejected');

      if (failedExtractions.length > 0) {
        logger.debug('Extraction errors', { metadata: { failedExtractions } });
      }

      const { heapTotal, heapUsed } = process.memoryUsage();
      const totalAvailableHeap = (heapTotal / 1024 / 1024 / 1024).toFixed(2);
      const totalUsedHeap = (heapUsed / 1024 / 1024 / 1024).toFixed(2);

      logger.debug(`[WORKER] Heap total: ${totalAvailableHeap} | Heap used: ${totalUsedHeap}`);
      return processedData;
    } catch (error) {
      logger.error('Error while consuming messages from stream.', { metadata: { error } });
    }
  }

  /**
   * Continuously consumes messages from all streams in the registry.
   *
   * @returns {Promise<void>} A promise that resolves when consumption is complete.
   */
  async consumer() {
    if (this.isInterrupted) {
      return;
    }

    const registry = Array.from(this.streamsRegistry.values());
    const [{ consumerGroupName } = {}] = registry;
    const streams = registry.map(({ streamName }) => streamName).filter(Boolean);

    if (registry.length > 0) {
      try {

        if (!consumerGroupName || streams.length === 0) {
          throw new Error('Incomplete data from the stream.');
        }

        await this.consumeFromStreams(streams, consumerGroupName);
      } catch (error) {
        logger.error('An error occurred while consuming streams:', {
          metadata: {
            details: error.message
          }
        });
      }
    }

    setTimeout(() => {
      this.consumer();
    }, 0);
  }

  /**
   * Starts the stream consumer.
   */
  start() {
    this.isInterrupted = false;
    this.consumer();
  }

  /**
   * Stops the stream consumer.
   */
  stop() {
    this.isInterrupted = true;
  }
}

const streamConsumerInstance = new StreamConsumer(
  REDIS_PUBSUB_COMMUNICATION_CHANNEL,
  'consumer-1',
  REDIS_CONSUMER_BATCH_SIZE,
  processStreamData
);

(() => {
  streamConsumerInstance.start();
})();
