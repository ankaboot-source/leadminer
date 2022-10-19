const Redis = require('ioredis');
const config = require('config');
const logger = require('./app/utils/logger')(module);
const freeProviders = require('./app/utils/FreeProviders.json');
const disposable = require('./app/utils/Disposable.json');
//*******█▌█▌ get the configuration from config file BEGIN *******
const redis = config.get('server.redis');
const redis_host = config.get('server.redis.host') ?? process.env.REDIS_HOST;
const redis_port = config.get('server.redis.port') ?? process.env.REDIS_PORT;
//*******get the configuration from config file END █▌█▌*******

function initializeRedis() {
  if (redis.password && redis.username) {
    return new Redis(redis_port, redis_host, {
      password: redis.password,
      user: redis.username
    });
  }
  //no password
  return new Redis(redis_port, redis_host);
}

/**
 * redisClientForInitialConnection creates a redis client
 * and connects to the redis server(used for initialization)
 * @returns A redis client object
 */
function redisClientForInitialConnection() {
  const redisClient = initializeRedis();

  redisClient.on('error', (err) => {
    logger.error('Error connecting with redisClient.', { error: err });
    throw err;
  });

  redisClient.on('connect', async () => {
    logger.info('Connected to redisClient ✔️');
    //init the redis db with domain providers strings
    const res = await redisClient.exists('freeProviders');
    if (res != 1) {
      freeProviders.forEach((domain) => {
        redisClient.sadd('freeProviders', domain);
      });
      logger.info('Redis initialized with freeProviders ✔️');

      disposable.forEach((domain) => {
        redisClient.sadd('disposable', domain);
      });
      logger.info('Redis initialized with disposable ✔️');
    } else {
      logger.info('Redis is already initialized ✔️');
    }
  });

  return redisClient;
}

/**
 * redisClientForPubSubMode creates a new Redis client
 * for pub/sub mode (workers).
 * @returns A function that returns a redis client.
 */
function getRedisClientForPubSubMode() {
  const redisClientForPubSubMode = initializeRedis();

  redisClientForPubSubMode.on('error', (err) => {
    logger.error('Error connecting with redisClientForPubSubMode.', {
      error: err
    });
    throw err;
  });
  redisClientForPubSubMode.on('connect', () => {
    logger.info('Connected to redis using pubSub connection');
  });
  return redisClientForPubSubMode;
}

/**
 * redisClientForNormalMode creates a redis client for normal mode
 * (all the app but without initialization)
 * @returns A function that returns a redis client.
 */
function redisClientForNormalMode() {
  const redisClientNormalMode = initializeRedis();

  redisClientNormalMode.on('error', (err) => {
    logger.error('Error connecting to redisClientNormalMode.', { error: err });
    throw err;
  });
  redisClientNormalMode.on('connect', () => {
    logger.info('Connected to redis using Normal connection');
  });
  return redisClientNormalMode;
}
module.exports = {
  redisClientForInitialConnection,
  redisClientForPubSubMode: getRedisClientForPubSubMode,
  redisClientForNormalMode
};
