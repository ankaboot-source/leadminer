import Redis from 'ioredis';
import {
  REDIS_HOST,
  REDIS_PASSWORD,
  REDIS_PORT,
  REDIS_TLS,
  REDIS_USERNAME
} from '../config';
import disposable from './Disposable.json';
import freeProviders from './FreeProviders.json';
import logger from './logger';

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
   * Returns Redis client instance.
   * Don't use this client to subscribe to pub/sub channels.
   * Instead, you should use `getSubscriberClient` for subscribing.
   * @returns {Redis} Redis client instance
   */
  getClient() {
    return this.#normalClient;
  }

  /**
   * Returns a duplicate of the Redis client instance that can be used
   * as a pub/sub subscriber.
   * @return Redis client instance
   */
  getSubscriberClient() {
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

export default redis;
