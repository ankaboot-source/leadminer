const logger = require("./app/utils/logger")(module);
const config = require("config");
const port = config.get("server.redis.port");
logger.debug("creating redis client...");
let redis = require("redis").createClient(port || 6379, {
  return_buffers: true,
});
redis.on("error", function (err) {
  logger.debug("can't connect to redis ✖️ ");
  console.error("Error connecting to redis", err);
  process.exit();
});
redis.on("connect", () => {
  logger.debug("connected to redis ✔️ ");
});
module.exports = redis;
