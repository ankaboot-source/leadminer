const Redis = require("ioredis");
const config = require("config");
const logger = require("./app/utils/logger")(module);
const freeProviders = require("./app/utils/FreeProviders.json");
const disposable = require("./app/utils/Disposable.json");
let redis = config.get("server.redis");
const redis_host = config.get("server.redis.host")
  ? config.get("server.redis.host")
  : process.env.REDIS_HOST;
const redis_port = config.get("server.redis.port")
  ? config.get("server.redis.port")
  : process.env.REDIS_PORT;

function redisClientForInitialConnection() {
  let redisClient = {};
  if (redis.password && redis.username) {
    redisClient = new Redis(
      redis_port,
      redis_host,
      redis.username,
      redis.password
    );
  } else {
    redisClient = new Redis(redis_port, redis_host);
  }
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
  return redisClient;
}

function redisClientForPubSubMode() {
  let redisClientForPubSubMode = {};
  if (redis.password && redis.username) {
    redisClientForPubSubMode = new Redis(
      redis_port,
      redis_host,
      redis.username,
      redis.password
    );
  } else {
    redisClientForPubSubMode = new Redis(redis_port, redis_host);
  }
  redisClientForPubSubMode.on("error", function (err) {
    logger.debug("can't connect to redisClientForPubSubMode ✖️ ");
    console.error("Error connecting to redisClientForPubSubMode", err);
    process.exit();
  });
  redisClientForPubSubMode.on("connect", () => {
    logger.debug("connected to redis using pubSub connection");
  });
  return redisClientForPubSubMode;
}

function redisClientForNormalMode() {
  let redisClientNormalMode = {};
  if (redis.password && redis.username) {
    redisClientNormalMode = new Redis(
      redis_port,
      redis_host,
      redis.username,
      redis.password
    );
  } else {
    redisClientNormalMode = new Redis(redis_port, redis_host);
  }
  redisClientNormalMode.on("error", function (err) {
    logger.debug("can't connect to redisClientNormalMode ✖️ ");
    console.error("Error connecting to redisClientNormalMode", err);
    process.exit();
  });
  redisClientNormalMode.on("connect", () => {
    logger.debug("connected to redis using Normal connection");
  });
  return redisClientNormalMode;
}
module.exports = {
  redisClientForInitialConnection,
  redisClientForPubSubMode,
  redisClientForNormalMode,
};
