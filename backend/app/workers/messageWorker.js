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
const processMessage = async (message) => {
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
 * @function consumeMessages
 */
(async () => {
  const CONSTANT_CONDITION = true; // Bypass  lint checker
  let lastReadId = '$';

  while (CONSTANT_CONDITION) {
    const result = await redisStreamsConsumer.xread(
      'BLOCK',
      0,
      'STREAMS',
      REDIS_MESSAGES_CHANNEL,
      lastReadId
    );

    if (result) {
      const [channel, messages] = result[0];
      lastReadId = messages[messages.length - 1][0];

      logger.debug('Consuming messages', {
        channel,
        totalMessages: messages.length,
        lastMessageID: lastReadId
      });

      messages.forEach(processMessage);
    }
  }
})();
