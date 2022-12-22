const { redis } = require('../utils/redis');
const redisClient = redis.getPubSubClient();
const EmailMessage = require('../services/EmailMessage');
const { storage } = require('../services/storage');
const { REDIS_MESSAGES_CHANNEL } = require('../utils/constants');
const logger = require('../utils/logger')(module);

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
      isLast
    );
    
    if (this.isLast) {
      await db.refinePersons(this.user.id);
    }

    await message.extractEmailsAddresses().then(async (data) => {
      await storage.storeData(message.user.id, data);
    });
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
