const { redis } = require('../utils/redis');
const EmailMessage = require('../services/EmailMessage');
const { logger } = require('../utils/logger');
const { db } = require('../db');
const { REDIS_CONSUMER_BATCH_SIZE } = require('../config');
const {
  REDIS_STREAM_NAME,
  REDIS_CONSUMER_GROUP_NAME
} = require('../utils/constants');
const redisClient = redis.getDuplicatedClient();
const redisStreamsConsumer = redis.getDuplicatedClient();
const redisClientForNormalMode = redis.getClient();

/**
 * @param {number} seqNumber - Sequence number of the message in its folder.
 * @param {object} body - Body of the email message.
 * @param {object} header - Header of the email message.
 * @param {string} folderName - Name of the folder containing the email message.
 * @param {string} userId - User ID associated with the email message.
 * @param {string} userEmail - Email address of the user associated with the email message.
 * @param {string} userIdentifierHash - Hash of the user identifier associated with the email message.
 * @param {boolean} isLast - Indicates if this is the last message in the folder.
 * @param {string} progressID - Unique ID associated with the progress.
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
  progressID
}) {
  const messageId = header['message-id'] ? header['message-id'][0] : '';

  if (messageId === '') {
    return;
  }

  const message = new EmailMessage(
    redisClientForNormalMode,
    userEmail,
    seqNumber,
    header,
    body,
    folderName
  );

  const extractedContacts = await message.extractEmailsAddresses();
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
  const count = await redisClient.hincrby(progressID, 'extracting', 1);
  logger.info('Incrementing progess', { progressID, count });
}

/**
 * Asynchronously processes a message from a Redis stream by parsing the data and passing it to the handleMessage function
 * @param {Array} message - Array containing the stream message ID and the message data
 */
const streamProcessor = async (message) => {
  const [streamMessageID, msg] = message;
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
