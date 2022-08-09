const Imap = require("imap");
const { parentPort } = require("worker_threads");

/**
 * Pushes the message to the queue and then calls the getMessageFromQueue function to get the
 * message from the queue asynchronously
 * @param seqNumber - The sequence number of the message
 * @param Header - The header of the email
 * @param Body - The body of the email
 * @param folderName - The name of the folder that the message is in.
 */
parentPort.on("message", (contents) => {
  let header = Imap.parseHeader(contents.header);
  parentPort.postMessage(header);
});
// function pushMessageToQueue(seqNumber, header, Body, folderName) {
//   // if (this.sends.includes(seqNumber)) {
//   //   this.sendMiningProgress(seqNumber, folderName);
//   // }
//   // let message_id = header["message-id"] ? header["message-id"][0] : "";
//   // setTimeout(() => {
//   //   redisClient.sIsMember("messages", message_id).then((alreadyMined) => {
//   //   if (!alreadyMined) {
//   //   if (Body && Body != "") {
//   //     redisClient.lPush("bodies", Body).then((reply) => {
//   //       this.getMessageFromQueue(seqNumber, "body", "");
//   //     });
//   //   }
//   //   if (header && header != "") {
//   //     redisClient.lPush("headers", JSON.stringify(header)).then((reply) => {
//   //       this.getMessageFromQueue(seqNumber, "header", "");
//   //     });
//   //   }
//   //   }
//   //   });
//   // }, 90);
// }
