//this is a worker to handle the messages
const { parentPort } = require("worker_threads");
const redisClient = require("../../redis").redisClientForPubSubMode();
const EmailMessage = require("../services/EmailMessage");

parentPort.on("message", () => {
  redisClient.subscribe("messages-channel", (err, count) => {
    if (err) {
      console.log(err);
    } else {
      console.log("subscribed to messages-channel");
    }
  });
});

redisClient.on("message", (channel, messageFromChannel) => {
  let message = JSON.parse(messageFromChannel);
  const Header = JSON.parse(message.header);
  const message_id = Header["message-id"] ? Header["message-id"][0] : "";
  const Message = new EmailMessage(
    message.seqNumber,
    Header,
    message.body,
    message.user
  );
  if (message_id) {
    console.log(message.seqNumber);
    // Extract emails from the header
    Message.extractEmailAddressesFromHeader();
    // Extract emails from the Body
    Message.extractEmailAddressesFromBody();
  }
});

// });
