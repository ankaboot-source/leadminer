const Redis = require("ioredis");
const redisClient = require("./redis");

const { Worker } = require("worker_threads");
const worker = new Worker("./worker.js", "init");

const main = () => {
  redisClient.publish(
    "send-user-data",
    JSON.stringify({ hello: "hello word" })
  );
  for (let i = 0; i < 15; i++) {
    setTimeout(() => {
      redisClient.publish(
        "send-user-data",
        JSON.stringify({ hello: "hello word" })
      );
    }, 1500);
  }
  console.log("published");
};
main();
