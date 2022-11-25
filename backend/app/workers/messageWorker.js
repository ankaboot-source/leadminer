//this is a worker to handle the messages
const { parentPort } = require('worker_threads');
const { redis } = require('../utils/redis');
const redisClient = redis.getPubSubClient();
const EmailMessage = require('../services/EmailMessage');
const logger = require('../utils/logger')(module);

parentPort.on('message', (channel) => {
  //subscribe to created channel
  redisClient.subscribe(channel, (err) => {
    if (err) {
      logger.debug(
        `error in message worker, can't subscribe to channel ${err}`
      );
    } else {
      logger.debug(`worker subscribed to ${channel}.`);
    }
  });
});

redisClient.on('message', async (channel, messageFromChannel) => {
  const message = JSON.parse(messageFromChannel);
  const Header = message.header;
  const message_id = Header['message-id'] ? Header['message-id'][0] : '';
  const Message = new EmailMessage(
    message.seqNumber,
    Header,
    message.body,
    message.user,
    message.folderName
  );
  if (message_id) {
    // Extract emails from the header
    await Message.extractThenStoreEmailsAddresses();
  }
});
