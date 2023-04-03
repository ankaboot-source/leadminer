const Redis = require('ioredis');
const { logger } = require('./logger');
const freeProviders = require('./FreeProviders.json');
const disposable = require('./Disposable.json');
const {
  REDIS_HOST,
  REDIS_PORT,
  REDIS_USERNAME,
  REDIS_PASSWORD,
  REDIS_TLS
} = require('../config');

class RedisManager {
  /**
   * Redis client instance
   * @private
   */
  #normalClient;

  /**
   * @constructor
   * @param {string} host - Redis host
   * @param {number} port - Redis port
   * @param {string} user - Redis user
   * @param {string} password - Redis password
   * @param {boolean} tls - Enable tls
   */
  constructor(host, port, user, password, tls) {
    let redisOpts = {
      host,
      port
    };

    if (tls) {
      redisOpts = {
        ...redisOpts,
        tls: {}
      };
    }

    if (user && password) {
      redisOpts = {
        ...redisOpts,
        user,
        password
      };
    }

    this.#normalClient = new Redis(redisOpts);
  }

  /**
   * Initialize the redis db with domain providers strings.
   * @returns {Promise}
   */
  async initProviders() {
    try {
      await this.#normalClient.sadd('freeProviders', freeProviders);
      logger.info('Redis initialized with freeProviders ✔️');

      await this.#normalClient.sadd('disposable', disposable);
      logger.info('Redis initialized with disposable ✔️');
    } catch (error) {
      logger.error('Failed initializing redis.', { metadata: { error } });
    }
  }

  /**
   * Deletes all the keys of all the existing databases in redis.
   * @returns {Promise<void>}
   */
  async flushAll() {
    try {
      const status = await this.#normalClient.flushall();
      logger.info(`Flush status: ${status} ✔️`);
    } catch (error) {
      logger.error('Failed flushing Redis.');
    }
  }

  /**
   * Returns the original Redis client instance
   * @returns {Redis} Redis client instance
   */
  getClient() {
    return this.#normalClient;
  }

  /**
   * Returns a duplicate of the original Redis client instance
   * @return {object} Redis client instance
   */
  getDuplicatedClient() {
    return this.#normalClient.duplicate();
  }
}

const redis = new RedisManager(
  REDIS_HOST,
  REDIS_PORT,
  REDIS_USERNAME,
  REDIS_PASSWORD,
  REDIS_TLS
);

module.exports = {
  redis
};
