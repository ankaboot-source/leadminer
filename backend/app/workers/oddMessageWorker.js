//this is a worker to handle the messages
const { parentPort } = require('worker_threads');
const redisClient = require('../../redis').redisClientForPubSubMode();
const EmailMessage = require('../services/EmailMessage');
const logger = require('../utils/logger')(module);

parentPort.on('message', (userID) => {
  const used = process.memoryUsage().heapUsed / 1024 / 1024;
  console.log(`Used Memory for odd worker ${used} mb`);
  //subscribe to created channel
  redisClient.subscribe(`odd-messages-channel-${userID}`, (err) => {
    if (err) {
      logger.debug(
        `error in message worker, can't subscribe to channel ${err}`
      );
    } else {
      logger.debug(`odd worker ${userID} is subscribed to its channel`);
    }
  });
});

redisClient.on('message', (channel, messageFromChannel) => {
  const used = process.memoryUsage().heapUsed / 1024 / 1024;
  console.log(`Used Memory worker ${used} mb`);
  const message = JSON.parse(messageFromChannel);
  const Header = JSON.parse(message.header);
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
    Message.extractThenStoreEmailsAddresses();
  }
});
