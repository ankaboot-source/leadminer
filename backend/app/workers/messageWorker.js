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
  user,
  isLast
}) {
  const messageId = header['message-id'] ? header['message-id'][0] : '';
  if (messageId) {
    const message = new EmailMessage(
      redisClientForNormalMode,
      user.email,
      seqNumber,
      header,
      body,
      folderName,
      isLast // If it's the last element that comes from (fetch/redis).
    );
    const logDetails = {
      userHash: user.userIdentifierHash,
      messageDate: message.getDate()
    };

    logger.debug('Extracting from message', logDetails);
    const extractedContacts = await message.extractEmailsAddresses();
    logger.debug('Inserting contacts to DB', logDetails);
    await db.store(extractedContacts, user.id);

    if (isLast) {
      logger.debug('Calling refined_persons', {...logDetails, isLast});
      db.callRpcFunction(user.id, 'refined_persons');
    } // runs rpc function.
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
    userHash: data.user.userIdentifierHash
  });

  switch (channel) {
    case REDIS_MESSAGES_CHANNEL:
      await handleMessage(data);
      break;
    default:
      break;
  }
});