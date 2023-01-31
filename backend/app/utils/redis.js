const Redis = require('ioredis');
const logger = require('./logger')(module);
const freeProviders = require('./FreeProviders.json');
const disposable = require('./Disposable.json');
const {
  redisUsername,
  redisPassword,
  redisHost,
  redisPort,
  redisTls
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
   * @param {string} user - Redis user
   * @param {string} password - Redis password
   * @param {boolean} tls - Enable tls
   */
  constructor(host, port, user, password, tls) {
    let redisOpts = {
      host,
      port
    };

    if (tls === 'true') {
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
  parseInt(redisPort),
  redisUsername,
  redisPassword,
  redisTls
);

module.exports = {
  redis
};
