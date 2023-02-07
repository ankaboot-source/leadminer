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
        // await db.callRpcFunction(userId, 'refined_persons');
      } catch (error) {
        logger.error('Failed refining persons.', {
          error,
          userHash: userIdentifierHash
        });
      }
    }
  }

  let informedSubscribers = 0;
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
    this.streamProcessor = processor;
    this.streamChannel = streamChannel;
    this.isInterrupted = false;
  }

  /**
   * Continuously consumes messages from a Redis stream, processes them and updates the last read message ID
   */
  async consumeStreamMessages() {
    let lastProcessedMessageId = null;
    while (!this.isInterrupted) {
      try {
        const result = await redisStreamsConsumer.xread(
          'BLOCK',
          0,
          'COUNT',
          1,
          'STREAMS',
          this.streamChannel,
          lastProcessedMessageId ?? '$'
        );

        if (result) {
          const [channel, message] = result[0];
          lastProcessedMessageId = message[0][0];

          logger.debug('Consuming message', {
            channel,
            lastProcessedMessageId
          });

          await Promise.all([
            this.streamProcessor(message[0]),
            redisStreamsConsumer.xdel(
              this.streamChannel,
              lastProcessedMessageId
            )
          ]);

          if (global.gc !== undefined) {
            global.gc();
            logger.debug('Invoked garbage collector');
          }
        }
      } catch (error) {
        logger.error(`Error while consuming message: ${error.message}`);
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
  REDIS_MESSAGES_CHANNEL,
  streamProcessor
);

(async () => {
  await streamConsumerInstance.start();
})();
