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
  const message_id = header['message-id'] ? header['message-id'][0] : '';
  if (message_id) {
    const message = new EmailMessage(
      redisClientForNormalMode,
      user.email,
      seqNumber,
      header,
      body,
      folderName,
      isLast // If it's the last element that comes from (fetch/redis).
    );

    const extractedContacts = await message.extractEmailsAddresses();
    await db.store(extractedContacts, user.id);
    console.log(isLast);

    if (isLast) {
      try {
        await db.callRpcFunction(user.id, 'populate_refined');
        await db.callRpcFunction(user.id, 'refined_persons');
      } catch (error) {
        logger.error('Failed refining persons.', { error });
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

  switch (channel) {
    case REDIS_MESSAGES_CHANNEL:
      await handleMessage(data);
      break;
    default:
      break;
  }
});
