const { parentPort } = require("worker_threads");
const redisClient = require("../../redis");
const EmailMessage = require("../services/EmailMessage");

// get data from parent
parentPort.on("message", (message) => {
  const Message = new EmailMessage(
      message.seq,
      message.header,
      message.body,
      message.user,
      message.date
    ),
    message_id = Message.getMessageId();
  if (message_id) {
    redisClient.sadd("messages", message_id).then(() => {
      Message.extractEmailAddressesFromHeader();
      Message.extractEmailAddressesFromBody();
    });
  }
});
