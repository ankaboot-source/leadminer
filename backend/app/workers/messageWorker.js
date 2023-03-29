const { logger } = require('../utils/logger');
const { redis } = require('../utils/redis');
const { processStreamData } = require('./handlers');
const { REDIS_CONSUMER_BATCH_SIZE } = require('../config');
const redisStreamsConsumer = redis.getDuplicatedClient();
const redisSubscriber = redis.getDuplicatedClient();
const publisher = redis.getDuplicatedClient();

const {
  REDIS_PUBSUB_COMMUNICATION_CHANNEL
} = require('../utils/constants');

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

    // Listen for messages on the Redis channel.
    redisSubscriber.on('message', (_, data) => {
      const { miningId, command, streamName, consumerGroupName } = JSON.parse(data);

      // Add stream to registry when command is "register" otherwise delete it if exists. 
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
   * @param {string} streamName - The name of the Redis stream to consume messages from
   * @param {string} consumerGroupName - The name of the Redis consumer group to read from
   * @returns {Promise} - A Promise that resolves when the stream is consumed successfully, or rejects with an error
   */
  async consumeSingleStream(streamName, consumerGroupName) {
    try {
      const result = await redisStreamsConsumer.xreadgroup(
        'GROUP',
        consumerGroupName,
        this.consumerName,
        'COUNT',
        this.batchSize,
        'BLOCK',
        1,
        'STREAMS',
        streamName,
        '>'
      );

      if (result === null) {
        return Promise.resolve(null);
      }

      const messages = result[0][1];
      const processedMessageIDs = messages.map((message) => message[0]);
      const lastMessageId = processedMessageIDs.slice(-1)[0];

      const extractionResults = await Promise.allSettled([
        ...messages.map((message) => this.messageProcessor(message))
      ]);

      const failedExtractionResults = extractionResults.filter(
        (extractionResult) => extractionResult.status !== 'fulfilled'
      );

      if (failedExtractionResults.length > 0) {
        logger.debug('Extraction errors', {
          metadata: { failedExtractionResults }
        });
      }

      const miningId = extractionResults[0].value;
      const progress = { miningId, progressType: 'extracted', count: extractionResults.length };

      logger.debug('Publishing progress from worker', {
        metadata:
        {
          details:
          {
            pubsubChannel: streamName,
            consumerGroupName,
            consumerName: this.consumerName,
            progress
          }
        }
      });

      await publisher.publish(
        // Publish the progress object as a JSON string to the Redis pub/sub channel.
        miningId,
        JSON.stringify(progress)
      );

      await redisStreamsConsumer.xack(
        // This marks the specified messages as processed and removes them
        // from the pending list of the consumer group.
        streamName,
        consumerGroupName,
        ...processedMessageIDs
      );

      await redisStreamsConsumer.xtrim(
        // Trim the stream channel to remove messages that have already been processed.
        streamName,
        'MINID',
        lastMessageId
      );

      const { heapTotal, heapUsed } = process.memoryUsage();
      logger.debug(
        `[WORKER] Heap total: ${(heapTotal / 1024 / 1024 / 1024).toFixed(
          2
        )} | Heap used: ${(heapUsed / 1024 / 1024 / 1024).toFixed(2)} `
      );
      return Promise.resolve(extractionResults);
    } catch (error) {
      logger.error('Error while consuming messages from stream.', {
        metadata: {
          details: error.message
        }
      });
      return Promise.reject(error);
    }
  }

  /**
   * Continuously consumes messages from all streams in the registry.
   *
   * @returns {Promise<void>} A promise that resolves when consumption is complete.
   */
  async consumeStreams() {

    if (this.isInterrupted) {
      return;
    }

    const streams = Array.from(this.streamsRegistry.values());

    if (streams.length > 0) {
      // Consume messages from each registered stream.
      const consumePromises = streams.map(({ streamName, consumerGroupName }) => {
        return this.consumeSingleStream(streamName, consumerGroupName);
      });

      try {
        // Wait for all consumption promises to settle.
        await Promise.allSettled(consumePromises);
      } catch (error) {
        logger.error('An error occurred while consuming streams:', {
          metadata: {
            details: error.message
          }
        });
      }

    }

    setImmediate(() => {
      this.consumeStreams();
    });
  }

  /**
   * Starts the stream consumer.
   */
  start() {
    this.isInterrupted = false;
    this.consumeStreams();
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
