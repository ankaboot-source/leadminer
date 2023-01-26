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
  /**
   * Redis client instance
   * @private
   */
  #normalClient;

  /**
   * @constructor
   * @param {string} host - Redis host
   * @param {number} port - Redis port
   * @param {string} [user] - Redis user
   * @param {string} [password] - Redis password
   */
  constructor(host, port, user, password) {
    try {
      if (user && password) {
        this.#normalClient = new Redis(port, host, {
          password,
          user,
          tls: {
            rejectUnauthorized: false
          }
        });
      } else {
        this.#normalClient = new Redis(port, host);
      }
    } catch (error) {
      logger.error('Error connecting to Redis.', {
        error
      });
      throw error;
    }
  }

  /**
   * Initialize the redis db with domain providers strings.
   * @returns {Promise}
   */
  async loadData() {
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
  redisHost,
  redisPort,
  redisUsername,
  redisPassword
);

module.exports = {
  redis
};
