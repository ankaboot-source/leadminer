const { redis } = require('../utils/redis');
const redisClient = redis.getPubSubClient();
const redisClientForNormalMode = redis.getClient();
const EmailMessage = require('../services/EmailMessage');
const { REDIS_MESSAGES_CHANNEL } = require('../utils/constants');
const logger = require('../utils/logger')(module);
const { db } = require('../db');

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
}

redisClient.subscribe(REDIS_MESSAGES_CHANNEL, (err) => {
  if (err) {
    logger.error('Unable to subscribe to Redis.', err);
  } else {
    logger.info('Worker subscribed to Redis.');
  }
});

redisClient.on('message', async (channel, messageFromChannel) => {
  const data = JSON.parse(messageFromChannel);

  logger.debug('Consuming message', {
    channel,
    userHash: data.userIdentifierHash
  });

  switch (channel) {
    case REDIS_MESSAGES_CHANNEL:
      await handleMessage(data);
      break;
    default:
      break;
  }
});
