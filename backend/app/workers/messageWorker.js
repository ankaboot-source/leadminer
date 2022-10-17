//this is a worker to handle the messages
const { parentPort } = require('worker_threads');
const redisClient = require('../../redis').redisClientForPubSubMode();
const EmailMessage = require('../services/EmailMessage');
const logger = require('../utils/logger')(module);

parentPort.on('message', (userID) => {
  //subscribe to created channel
  redisClient.subscribe(`messages-channel-${userID}`, (err) => {
    if (err) {
      logger.debug(
        `error in message worker, can't subscribe to channel ${err}`
      );
    } else {
      logger.debug(`worker ${userID} is subscribed to its channel`);
    }
  });
});

redisClient.on('message', (channel, messageFromChannel) => {
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
