const Redis = require('ioredis');
const config = require('config');
const logger = require('./app/utils/logger')(module);
const freeProviders = require('./app/utils/FreeProviders.json');
const disposable = require('./app/utils/Disposable.json');
//*******█▌█▌ get the configuration from config file BEGIN *******
let redis = config.get('server.redis');
const redis_host = config.get('server.redis.host')
  ? config.get('server.redis.host')
  : process.env.REDIS_HOST;
const redis_port = config.get('server.redis.port')
  ? config.get('server.redis.port')
  : process.env.REDIS_PORT;
//*******get the configuration from config file END █▌█▌*******

/**
 * redisClientForInitialConnection creates a redis client and connects to the redis server(used for initialization)
 * @returns A redis client object
 */
function redisClientForInitialConnection() {
  let redisClient = {};
  //check for username and password
  if (redis.password && redis.username) {
    redisClient = new Redis(redis_port, redis_host, {
      password: redis.password,
      user: redis.username
    });
  } else {
    //no password
    redisClient = new Redis(redis_port, redis_host);
  }
  redisClient.on('error', (err) => {
    logger.error('Error connecting with redisClient.', { error: err });
    process.exit();
  });
  redisClient.on('connect', () => {
    logger.debug('Connected to redisClient ✔️');
    //init the redis db with domain providers strings
    redisClient.exists('freeProviders').then((res) => {
      if (res != 1) {
        freeProviders.map((domain) => {
          redisClient.sadd('freeProviders', domain);
        });
        logger.debug('Redis initialized with freeProviders✔️');
      }
    });
    redisClient.exists('freeProviders').then((res) => {
      if (res != 1) {
        disposable.map((domain) => {
          redisClient.sadd('disposable', domain);
        });
        logger.debug('Redis initialized with disposable ✔️');
      } else {
        logger.debug('Redis is already initialized ✔️');
      }
    });
  });
  return redisClient;
}

/**
 * redisClientForPubSubMode creates a new Redis client for pub/sub mode (workers)
 * @returns A function that returns a redis client.
 */
function getRedisClientForPubSubMode() {
  let redisClientForPubSubMode = {};
  if (redis.password && redis.username) {
    redisClientForPubSubMode = new Redis(redis_port, redis_host, {
      password: redis.password,
      user: redis.username
    });
  } else {
    redisClientForPubSubMode = new Redis(redis_port, redis_host);
  }
  redisClientForPubSubMode.on('error', (err) => {
    logger.error('Error connecting with redisClientForPubSubMode.', {
      error: err
    });
    process.exit();
  });
  redisClientForPubSubMode.on('connect', () => {
    logger.debug('Connected to redis using pubSub connection');
  });
  return redisClientForPubSubMode;
}

/**
 *redisClientForNormalModet creates a redis client for normal mode, (all the app but without initialization)
 * @returns A function that returns a redis client.
 */
function redisClientForNormalMode() {
  let redisClientNormalMode = {};
  if (redis.password && redis.username) {
    redisClientNormalMode = new Redis(redis_port, redis_host, {
      password: redis.password,
      user: redis.username
    });
  } else {
    redisClientNormalMode = new Redis(redis_port, redis_host);
  }
  redisClientNormalMode.on('error', (err) => {
    logger.error('Error connecting to redisClientNormalMode.', { error: err });
    process.exit();
  });
  redisClientNormalMode.on('connect', () => {
    logger.debug('Connected to redis using Normal connection');
  });
  return redisClientNormalMode;
}
module.exports = {
  redisClientForInitialConnection,
  redisClientForPubSubMode: getRedisClientForPubSubMode,
  redisClientForNormalMode
};
