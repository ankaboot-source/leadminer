const { logger } = require('../utils/logger');
const { db } = require('../db');
const EmailMessage = require('../services/EmailMessage');
const { redis } = require('../utils/redis');
const {
  REDIS_STREAM_NAME,
  REDIS_CONSUMER_GROUP_NAME,
  MAX_REDIS_PUBLISH_RETRIES_COUNT
} = require('../utils/constants');
const { REDIS_CONSUMER_BATCH_SIZE } = require('../config');
const redisStreamsConsumer = redis.getDuplicatedClient();
const redisPubSubClient = redis.getDuplicatedClient();
const redisClientForNormalMode = redis.getClient();

/**
 * Handles incoming email message and performs necessary operations like storing contact information,
 * populating refined_persons table and reporting progress.
 * @async
 * @function handleMessage
 * @param {Object} options - The options object.
 * @param {number} options.seqNumber - The sequence number of the email message.
 * @param {string} options.body - The body of the email message.
 * @param {string} options.header - The header of the email message.
 * @param {string} options.folderName - The name of the folder containing the email message.
 * @param {string} options.userId - The id of the user who received the email message.
 * @param {string} options.userEmail - The email of the user who received the email message.
 * @param {string} options.userIdentifierHash - The hash of the user's identifier.
 * @param {boolean} options.isLast - Indicates whether this is the last message in a sequence of messages.
 * @param {string} options.miningId - The id of the mining process.
 * @returns {Promise<void>}
 */
async function handleMessage({
  seqNumber,
  body,
  header,
  folderName,
  userId,
  userEmail,
  userIdentifierHash,
  isLast,
  miningId
}) {
  const message = new EmailMessage(
    redisClientForNormalMode,
    userEmail,
    seqNumber,
    header,
    body,
    folderName
  );

  const extractedContacts = await message.extractEmailAddresses();
  await db.store(extractedContacts, userId);

  if (isLast) {
    try {
      logger.info('Calling populate.', {
        metadata: {
          isLast,
          userHash: userIdentifierHash
        }
      });
      await db.callRpcFunction(userId, 'populate_refined');
    } catch (error) {
      logger.error('Failed populating refined_persons.', {
        metadata: {
          error,
          userHash: userIdentifierHash
        }
      });
    }
  }

  const extractingProgress = {
    miningId,
    progressType: 'extracting'
  };

  let retriesCount = 0;
  let informedSubscribers = 0;

  while (informedSubscribers === 0) {
    informedSubscribers = await redisPubSubClient.publish(
      miningId,
      JSON.stringify(extractingProgress)
    );

    if (retriesCount === MAX_REDIS_PUBLISH_RETRIES_COUNT) {
      logger.debug('No subscribers litening to PubSub channel', {
        informedSubscribers,
        retriesCount,
        pubSubChannel: miningId
      });
      break;
    }

    retriesCount++;
  }

  logger.info('Publishing extracting progress', { extractingProgress });
}

/**
 * Asynchronously processes a message from a Redis stream by parsing the data and passing it to the handleMessage function
 * @param {Array} message - Array containing the stream message ID and the message data
 */
const streamProcessor = async (message) => {
  const [, msg] = message;
  const data = JSON.parse(msg[1]);
  await handleMessage(data);
};

class StreamConsumer {
  /**
   * Creates an instance of StreamConsumer.
   * @param {string} streamName - The name of the Redis stream channel to consume messages from.
   * @param {string} consumerGroupName - The name of the Redis consumer group to add the consumer to.
   * @param {string} consumerName - The name of this consumer.
   * @param {number} batchSize - The number of messages to be processed in each batch.
   * @param {function} processor - The function that will process the messages consumed from the stream.
   */
  constructor(
    streamName,
    consumerGroupName,
    consumerName,
    batchSize,
    processor
  ) {
    this.streamProcessor = processor;
    this.streamChannel = streamName;
    this.consumerGroupName = consumerGroupName;
    this.consumerName = consumerName;
    this.batchSize = batchSize;
    this.isInterrupted = true;
  }

  /**
   * Continuously consumes messages from a Redis stream, processes them and updates the last read message ID
   */
  async consumeStreamMessages() {
    let processedMessageIDs = null;
    while (!this.isInterrupted) {
      try {
        const result = await redisStreamsConsumer.xreadgroup(
          'GROUP',
          this.consumerGroupName,
          this.consumerName,
          'COUNT',
          this.batchSize,
          'BLOCK',
          0,
          'STREAMS',
          this.streamChannel,
          '>'
        );
        if (result) {
          const messages = result[0][1];
          processedMessageIDs = messages.map((message) => message[0]);
          const lastMessageId = processedMessageIDs.at(-1);

          await Promise.all(
            messages.map(this.streamProcessor),
            redisStreamsConsumer.xack(
              this.streamChannel,
              this.consumerGroupName,
              ...processedMessageIDs
            )
          );

          await redisStreamsConsumer.xtrim(
            this.streamChannel,
            'MINID',
            lastMessageId
          );

          const { heapTotal, heapUsed } = process.memoryUsage();
          logger.debug(
            `[WORKER] Heap total: ${(heapTotal / 1024 / 1024 / 1024).toFixed(
              2
            )} | Heap used: ${(heapUsed / 1024 / 1024 / 1024).toFixed(2)} `
          );
        }
      } catch (error) {
        logger.error('Error while consuming messages from stream.', {
          metadata: {
            error
          }
        });
      }
    }
  }

  /**
   * Starts the stream consumer.
   */
  async start() {
    this.isInterrupted = false;
    await this.consumeStreamMessages();
  }

  /**
   * Stops the stream consumer.
   */
  stop() {
    this.isInterrupted = true;
  }
}

const streamConsumerInstance = new StreamConsumer(
  REDIS_STREAM_NAME,
  REDIS_CONSUMER_GROUP_NAME,
  'consumer-1',
  REDIS_CONSUMER_BATCH_SIZE,
  streamProcessor
);

(async () => {
  await streamConsumerInstance.start();
})();
