// const redisClient = () => {
//   return {
//     client: undefined,
//     setClient({ redis }) {
//       client = redis.createClient(6379);
//     },

//     getClient() {
//       return client;
//     },

//     connect({ redis, config, logger }) {
//       this.setClient({ redis, config });
//       client.on("connect", () => {
//         logger.info(`Redis connected on port: ${client?.options?.port}`);
//       });
//       client.on("error", (err) => {
//         logger.error(`500 - Could not connect to Redis: ${err}`);
//       });
//     },
//   };
// };

// module.exports = redisClient;
var redis = require("redis").createClient(6379, { return_buffers: true });

module.exports = redis;
