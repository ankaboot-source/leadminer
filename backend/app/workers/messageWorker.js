const { redis } = require('../utils/redis');
const EmailMessage = require('../services/EmailMessage');
const logger = require('../utils/logger')(module);
const { db } = require('../db');
const {
  REDIS_STREAM_NAME,
  REDIS_CONSUMER_GROUP_NAME,
  REDIS_CONSUMER_BATCH_SIZE
} = require('../config/index');
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

    let informedSubscribers = 0;
    while (informedSubscribers === 0) {
      informedSubscribers = await redisPubSubClient.publish(userId, true);
    }

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
   * @param {string} streamName - The name of the Redis stream channel to consume messages from.
   * @param {string} consumerGroupName - The name of the Redis consumer group to add the consumer to.
   * @param {string} consumerName - The name of this consumer.
   * @param {number} batchSize - The number of messages to be processed in each batch.
   * @param {function} processor - The function that will process the messages consumed from the stream.
   */
  constructor(streamName, consumerGroupName, consumerName, batchSize, processor) {
    this.streamProcessor = processor;
    this.streamChannel = streamName;
    this.consumerGroupName = consumerGroupName
    this.consumerName = consumerName;
    this.batchSize = batchSize
    this.isInterrupted = true;
  }

  /**
   * Continuously consumes messages from a Redis stream, processes them and updates the last read message ID
   */
  async consumeStreamMessages() {
    let processedMessageIDs = null
    while (!this.isInterrupted) {
      try {
        const result = await redisStreamsConsumer.xreadgroup(
          'BLOCK',
          0,
          'GROUP',
          this.consumerGroupName,
          this.consumerName,
          'COUNT',
          this.batchSize,
          'STREAMS',
          this.streamChannel,
          '>'
        );
        console.log(result)
        if (result) {
          const [channel, messages] = result[0];
          processedMessageIDs = messages.map(message => message[0]);

          logger.debug('Consuming messages', {
            channel,
            totalMessages: messages.length,
            lastMessageID: processedMessageIDs.at(-1)
          });

          await Promise.all(messages.map(this.streamProcessor));
          await redisStreamsConsumer.xack(this.streamChannel, this.consumerName, ...processedMessageIDs);
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
  REDIS_STREAM_NAME, REDIS_CONSUMER_GROUP_NAME, 'consumer-1', REDIS_CONSUMER_BATCH_SIZE, streamProcessor
);

(async () => {
  await streamConsumerInstance.start();
})();