const { REDIS_CONSUMER_BATCH_SIZE } = require('../config');
const { REDIS_PUBSUB_COMMUNICATION_CHANNEL } = require('../utils/constants');
const logger = require('../utils/logger');
const redis = require('../utils/redis');
const { processStreamData } = require('./handlers');

const redisSubscriber = redis.getSubscriberClient();
const redisClient = redis.getClient();

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
        [...streams],
        new Array(streams.length).fill('>')
      );

      if (result === null) {
        return null;
      }

      const processedData = await Promise.allSettled(
        result.map(async ([streamName, streamMessages]) => {
          const messageIds = streamMessages.map(([id]) => id);
          const lastMessageId = messageIds.slice(-1)[0];
          try {
            const startTime = performance.now();
            const promises = await Promise.allSettled(
              streamMessages.map((message) => this.messageProcessor(message))
            );
            const endTime = performance.now();
            const miningId = promises[0].value;
            const extractionProgress = {
              miningId,
              progressType: 'extracted',
              count: promises.length
            };

            logger.debug(
              `Extraction of ${messageIds.length} messages took ${
                endTime - startTime
              }ms`
            );
            redisClient.xack(streamName, consumerGroupName, ...messageIds);
            redisClient.publish(miningId, JSON.stringify(extractionProgress));
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
            redisClient.xtrim(streamName, 'MINID', lastMessageId);
            return promises;
          } catch (err) {
            return Promise.reject(err);
          }
        })
      );

      const failedExtractions = processedData.filter(
        (p) => p.status === 'rejected'
      );

      if (failedExtractions.length > 0) {
        logger.debug('Extraction errors', { metadata: { failedExtractions } });
      }

      const { heapTotal, heapUsed } = process.memoryUsage();
      const totalAvailableHeap = (heapTotal / 1024 / 1024 / 1024).toFixed(2);
      const totalUsedHeap = (heapUsed / 1024 / 1024 / 1024).toFixed(2);

      logger.debug(
        `[WORKER] Heap total: ${totalAvailableHeap} | Heap used: ${totalUsedHeap}`
      );
      return processedData;
    } catch (err) {
      logger.error('Error while consuming messages from stream.', {
        metadata: { err }
      });
      throw err;
    }
  }

  /**
   * Continuously consumes messages from all streams in the registry.
   *
   * @returns {Promise<void>} A promise that resolves when consumption is complete.
   */
  async consume() {
    if (this.isInterrupted) {
      return;
    }

    const registry = Array.from(this.streamsRegistry.values());
    const [{ consumerGroupName } = {}] = registry;
    const streams = registry
      .map(({ streamName }) => streamName)
      .filter(Boolean);

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
      this.consume();
    }, 0);
  }

  /**
   * Starts the stream consumer.
   */
  start() {
    this.isInterrupted = false;
    this.consume();
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
