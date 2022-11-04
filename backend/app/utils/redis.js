const Redis = require('ioredis');
const logger = require('./logger')(module);
const freeProviders = require('./FreeProviders.json');
const disposable = require('./Disposable.json');
const {
  redisUsername,
  redisPassword,
  redisHost,
  redisPort
} = require('../config/redis.config');

class RedisManager {
  #normalClient;

  constructor(host, port, user, password) {
    try {
      if (user && password) {
        this.#normalClient = new Redis(port, host, {
          password,
          user
        });
      }
      this.#normalClient = new Redis(port, host);
    } catch (error) {
      logger.error('Error connecting to Redis.', {
        error
      });
      throw error;
    }
  }

  async loadData() {
    //init the redis db with domain providers strings
    const res = await this.#normalClient.exists('freeProviders');
    if (res !== 1) {
      freeProviders.forEach((domain) => {
        this.#normalClient.sadd('freeProviders', domain);
      });
      logger.info('Redis initialized with freeProviders ✔️');

      disposable.forEach((domain) => {
        this.#normalClient.sadd('disposable', domain);
      });
      logger.info('Redis initialized with disposable ✔️');
    } else {
      logger.info('Redis is already initialized ✔️');
    }
  }

  getClient() {
    return this.#normalClient;
  }

  getPubSubClient() {
    return this.#normalClient.duplicate();
  }
}

const redis = new RedisManager(
  redisHost,
  redisPort,
  redisUsername,
  redisPassword
);

module.exports = {
  redis
};
