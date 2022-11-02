const config = require('config');

const redisUsername = config.has('server.redis.username')
  ? config.get('server.redis.username')
  : undefined;
const redisPassword = config.has('server.redis.password')
  ? config.get('server.redis.password')
  : undefined;
const redisHost = config.get('server.redis.host');
const redisPort = config.get('server.redis.port');

module.exports = {
  redisUsername,
  redisPassword,
  redisHost,
  redisPort
};
