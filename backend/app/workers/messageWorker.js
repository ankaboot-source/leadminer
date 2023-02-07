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
  // We manually force the garbage collector to avoid out of memory problems
  if (global.gc !== undefined) {
    logger.debug('Invoking garbage collector');
    global.gc();
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

/**
 * Continuously consumes messages from a Redis stream, processes them and updates the last read message ID
 */
async function consumeStreamMessages(channelName, streamProcessor) {
  let lastProcessedMessageId = null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const result = await redisStreamsConsumer.xread(
        'BLOCK',
        0,
        'COUNT',
        1,
        'STREAMS',
        channelName,
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
          streamProcessor(message[0]),
          redisStreamsConsumer.xdel(channelName, lastProcessedMessageId)
        ]);
      }
    } catch (error) {
      logger.error(`Error while consuming messages: ${error.message}`);
    }
  }
}

(async () => {
  await consumeStreamMessages(REDIS_MESSAGES_CHANNEL, streamProcessor);
})();
