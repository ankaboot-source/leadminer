const Redis = require("ioredis");
const config = require("config");
const logger = require("./app/utils/logger")(module);
const freeProviders = require("./app/utils/FreeProviders.json");
const disposable = require("./app/utils/Disposable.json");
const redis_host = config.get("server.redis.host")
  ? config.get("server.redis.host")
  : process.env.REDIS_HOST;
const redis_port = config.get("server.redis.port")
  ? config.get("server.redis.port")
  : process.env.REDIS_PORT;
const redis_login = config.get("server.redis.login")
  ? config.get("server.redis.login")
  : process.env.REDIS_LOGIN;
const redis_login = config.get("server.redis.password")
  ? config.get("server.redis.password")
  : process.env.REDIS_PASSWORD;
logger.debug("creating redis client...");
const redisClient = new Redis(redis_port, redis_host);
redisClient.on("error", function (err) {
  logger.debug("can't connect to redisClient ✖️ ");
  console.error("Error connecting to redisClient", err);
  process.exit();
});
redisClient.on("connect", () => {
  logger.debug("connected to redisClient ✔️");
  redisClient.exists("freeProviders").then((res) => {
    if (res != 1) {
      freeProviders.map((domain) => {
        redisClient.sadd("freeProviders", domain);
      });
      logger.debug("redis initialized with freeProviders✔️");
    }
  });
  redisClient.exists("freeProviders").then((res) => {
    if (res != 1) {
      disposable.map((domain) => {
        redisClient.sadd("disposable", domain);
      });
      logger.debug("redis initialized with disposable ✔️");
    } else {
      logger.debug("redis is already initialized ✔️");
    }
  });
});
module.exports = redisClient;
