const config = require('config');

const redisUsername =
  process.env.REDIS_USERNAME ?? config.get('server.redis.username');

const redisPassword =
  process.env.REDIS_PASSWORD ?? config.get('server.redis.password');

const redisHost = process.env.REDIS_HOST ?? config.get('server.redis.host');
const redisPort = process.env.REDIS_PORT ?? config.get('server.redis.port');
const redisTls = process.env.REDIS_TLS ?? config.get('server.redis.tls');

module.exports = {
  redisUsername,
  redisPassword,
  redisHost,
  redisPort,
  redisTls
};
