const Redis = require("ioredis");
const config = require("config");
const logger = require("./app/utils/logger")(module);

const redis_host = config.get("server.redis.host")
  ? config.get("server.redis.host")
  : process.env.REDIS_HOST;
const redis_port = config.get("server.redis.port")
  ? config.get("server.redis.port")
  : process.env.REDIS_PORT;
logger.debug("creating redis client...");
const redisClient = new Redis(redis_port, redis_host);
redisClient.on("error", function (err) {
  logger.debug("can't connect to redisClient ✖️ ");
  console.error("Error connecting to redisClient", err);
  process.exit();
});
redisClient.on("connect", () => {
  logger.debug("connected to redisClient ✔️ ");
});
module.exports = redisClient;
