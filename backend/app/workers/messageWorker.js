const { redis } = require('../utils/redis');
const EmailMessage = require('../services/EmailMessage');
const { REDIS_MESSAGES_CHANNEL } = require('../utils/constants');
const logger = require('../utils/logger')(module);
const { db } = require('../db');

const redisStreamsConsumer = redis.getDuplicatedClient();
const redisPubSubClient = redis.getDuplicatedClient();
const redisClientForNormalMode = redis.getClient();

async function handleMessage({
  seqNumber,
  body,
  header,
  folderName,
  userId,
  userEmail,
  userIdentifierHash,
  isLast
}) {
  const messageId = header['message-id'] ? header['message-id'][0] : '';
  if (messageId) {
    const message = new EmailMessage(
      redisClientForNormalMode,
      userEmail,
      seqNumber,
      header,
      body,
      folderName
    );

    const extractedContacts = await message.extractEmailsAddresses();
    logger.debug('Inserting contacts to DB.', { userHash: userIdentifierHash });
    await db.store(extractedContacts, userId);

    if (isLast) {
      try {
        await db.callRpcFunction(userId, 'populate_refined');
        logger.info('Calling refined_persons.', {
          isLast,
          userHash: userIdentifierHash
        });
      } catch (error) {
        logger.error('Failed refining persons.', {
          error,
          userHash: userIdentifierHash
        });
      }
    }
  }

  let informedSubscribers = 0;
  // Ensure that the message was delivered
  while (informedSubscribers === 0) {
    informedSubscribers = await redisPubSubClient.publish(userId, true);
  }
}

/**
 * Asynchronously processes a message from a Redis stream by parsing the data and passing it to the handleMessage function
 * @param {Array} message - Array containing the stream message ID and the message data
 */
const streamProcessor = async (message) => {
  const [streamMessageID, msg] = message;
  const data = JSON.parse(msg[1]);
  logger.debug('Processing message', {
    streamMessageID,
    userIdentifier: data.userIdentifier
  });
  await handleMessage(data);
};

class StreamConsumer {
  /**
   * Creates an instance of StreamConsumer.
   * @param {string} streamChannel - The name of the Redis stream channel to consume messages from.
   * @param {function} processor - The function that will process the messages consumed from the stream.
   */
  constructor(streamChannel, processor) {
    this.STREAM_PROCESSOR = processor;
    this.STREAM_CHANNEL = streamChannel;
    this.CONSUME_STREAM = true;

    this.processedMessageIDs = [];
  }

  /**
   * Continuously consumes messages from a Redis stream, processes them and updates the last read message ID
   */
  async consumeStreamMessages() {
    while (this.CONSUME_STREAM) {
      try {
        const result = await redisStreamsConsumer.xread(
          'BLOCK',
          0,
          'STREAMS',
          this.STREAM_CHANNEL,
          this.processedMessageIDs.length
            ? this.processedMessageIDs.at(-1)
            : '$'
        );

        if (result) {
          const [channel, messages] = result[0];

          this.processedMessageIDs = messages.map((message) => message[0]);
          if (this.processedMessageIDs.length > 0) {
            // Delete the previous processed messages
            await redisStreamsConsumer.xdel(
              this.STREAM_CHANNEL,
              ...this.processedMessageIDs
            );
          }

          logger.debug('Consuming messages', {
            channel,
            totalMessages: messages.length,
            lastMessageID: this.processedMessageIDs.at(-1)
          });

          await Promise.all(messages.map(this.STREAM_PROCESSOR));

          const { heapTotal, heapUsed } = process.memoryUsage();
          logger.debug(
            `[WORKER] Heap total: ${(heapTotal / 1024 / 1024 / 1024).toFixed(
              2
            )} | Heap used: ${(heapUsed / 1024 / 1024 / 1024).toFixed(2)} `
          );
        }
      } catch (error) {
        logger.error(`Error while consuming messages: ${error.message}`);
      }
    }
  }

  /**
   * Starts the stream consumer.
   */
  async start() {
    this.CONSUME_STREAM = true;
    await this.consumeStreamMessages();
  }

  /**
   * Stops the stream consumer.
   */
  stop() {
    this.CONSUME_STREAM = false;
  }
}

const streamConsumerInstance = new StreamConsumer(
  REDIS_MESSAGES_CHANNEL,
  streamProcessor
);

(async () => {
  await streamConsumerInstance.start();
})();
