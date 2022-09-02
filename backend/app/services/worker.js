const { parentPort, workerData } = require("worker_threads");
const redisClient = require("../../redis");
const EmailMessage = require("./EmailMessage");

parentPort.on("message", (message) => {
  const Message = new EmailMessage(
    message.seq,
    message.size,
    message.header,
    message.body,
    message.user,
    message.date
  );
  const message_id = Message.getMessageId();
  if (message_id) {
    redisClient.sadd("messages", message_id).then(() => {
      Message.extractEmailObjectsFromHeader();
      Message.extractEmailObjectsFromBody();
    });
  }
});
