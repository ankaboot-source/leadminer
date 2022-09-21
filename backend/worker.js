//this is a worker to handle the messages
const { parentPort } = require("worker_threads");
const redisClient = require("./redis");

const main = () => {
  redisClient.subscribe("send-user-data", (err, count) => {
    console.log(err, count);
  });
  redisClient.on("message", (channel, message) => {
    console.log(`Received message from ${channel} channel.`);
    console.log(message);
  });
  // ...
};

main();
