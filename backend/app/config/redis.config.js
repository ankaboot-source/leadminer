const config = require('config');

const redisUsername = config.has('server.redis.username')
  ? config.get('server.redis.username')
  : undefined;
const redisPassword = config.has('server.redis.password')
  ? config.get('server.redis.password')
  : undefined;
const redisHost = config.has('server.redis.host')
  ? config.get('server.redis.host')
  : process.env.REDIS_HOST;
const redisPort = config.has('server.redis.port')
  ? config.get('server.redis.port')
  : process.env.REDIS_PORT;

module.exports = {
  redisUsername,
  redisPassword,
  redisHost,
  redisPort
};
