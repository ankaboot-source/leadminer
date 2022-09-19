//this is a worker to handle the messages
const { parentPort } = require("worker_threads");
const redisClient = require("../../redis");
const EmailMessage = require("../services/EmailMessage");

/* Listening for a message event from the parent thread.
 * This worker is used to extract emails addresss from
 * message header and body.
 */
parentPort.on("message", (message) => {
  // Create Message object using recieved email message data
  const Message = new EmailMessage(
      message.seq,
      message.header,
      message.body,
      message.user,
      message.date
    ),
    //Get the message id
    message_id = Message.getMessageId();
  if (message_id) {
    //Check if the message is already mined using it's ID
    redisClient.sadd("messages", message_id).then(() => {
      // Extract emails from the header
      Message.extractEmailAddressesFromHeader();
      // Extract emails from the Body
      Message.extractEmailAddressesFromBody();
    });
  }
});
