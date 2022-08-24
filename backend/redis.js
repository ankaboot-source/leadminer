const logger = require("./app/utils/logger")(module);
const config = require("config");
const redis_url = config.get("server.redis.url")
  ? config.get("server.redis.url")
  : process.env.REDIS_URL;
logger.debug("creating redis client...");
let redis = require("redis");
const redisClient = redis.createClient({
  url: `redis://${redis_url}`,
});
redisClient.on("error", function (err) {
  logger.debug("can't connect to redisClient ✖️ ");
  console.error("Error connecting to redisClient", err);
  process.exit();
});
redisClient.on("connect", () => {
  logger.debug("connected to redisClient ✔️ ");
});
module.exports = redisClient;
