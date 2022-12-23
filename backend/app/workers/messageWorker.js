const { redis } = require('../utils/redis');
const redisClient = redis.getPubSubClient();
const EmailMessage = require('../services/EmailMessage');
const { storage } = require('../services/storage');
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
      seqNumber,
      header,
      body,
      user,
      folderName,
      isLast // If it's the last element that comes from (fetch/redis).
    );

    await message.extractEmailsAddresses().then(async (data) => {
      await storage.storeData(message.user.id, isLast, data);
    });
    if (isLast) {
      db.refinePersons(user.id); // runs rpc function.
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
