const { parentPort } = require("worker_threads");
const EmailMessage = require("./EmailMessage");
const redisClient = require("../../redis");
redisClient.connect();
/**
 * Pushes the message to the queue and then calls the getMessageFromQueue function to get the
 * message from the queue asynchronously
 * @param seqNumber - The sequence number of the message
 * @param Header - The header of the email
 * @param Body - The body of the email
 * @param folderName - The name of the folder that the message is in.
 */
parentPort.on("message", (contents) => {
  console.log("worker 11");
  let message = new EmailMessage(
    0,
    0,
    contents.header,
    contents.body,
    contents.user
  );
  let message_id = message.getMessageId();
  redisClient.sIsMember("messages", message_id).then((alreadyMined) => {
    if (!alreadyMined) {
      if (message_id) {
        redisClient.sAdd("messages", message_id).then(() => {
          message.extractEmailObjectsFromHeader();
          message.extractEmailObjectsFromBody();
        });
      }
    }
  });
});
