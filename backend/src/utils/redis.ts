import Redis, { RedisOptions } from 'ioredis';
import ENV from '../config';
import disposable from './Disposable.json';
import freeProviders from './FreeProviders.json';
import logger from './logger';

class RedisManager {
  private readonly normalClient;

  /**
   * @constructor
   * @param host - Redis host
   * @param port - Redis port
   * @param user - Redis user
   * @param password - Redis password
   * @param  tls - Enable tls
   */
  constructor(
    host: string,
    port: number,
    user: string | undefined,
    password: string | undefined,
    db: number,
    tls: boolean
  ) {
    let redisOpts: RedisOptions = {
      host,
      port,
      db,
      maxRetriesPerRequest: null
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
        username: user,
        password
      };
    }

    this.normalClient = new Redis(redisOpts);
  }

  /**
   * Initialize the redis db with domain providers strings.
   */
  async initProviders() {
    try {
      await this.normalClient.sadd('freeProviders', freeProviders);
      logger.info('Redis initialized with freeProviders ✔️');

      await this.normalClient.sadd('disposable', disposable);
      logger.info('Redis initialized with disposable ✔️');
    } catch (error) {
      logger.error('Failed initializing redis.', error);
    }
  }

  /**
   * Deletes all the keys of all the existing databases in redis.
   */
  async flushAll() {
    try {
      const status = await this.normalClient.flushall();
      logger.info(`Flush status: ${status} ✔️`);
    } catch (error) {
      logger.error('Failed flushing Redis.', error);
    }
  }

  /**
   * Returns Redis client instance.
   * Don't use this client to subscribe to pub/sub channels.
   * Instead, you should use `getSubscriberClient` for subscribing.
   * @returns Redis client instance
   */
  getClient() {
    return this.normalClient;
  }

  /**
   * Returns a duplicate of the Redis client instance that can be used
   * as a pub/sub subscriber.
   * @return Redis client instance
   */
  getSubscriberClient() {
    return this.normalClient.duplicate();
  }
}

const redis = new RedisManager(
  ENV.REDIS_HOST,
  ENV.REDIS_PORT,
  ENV.REDIS_USERNAME,
  ENV.REDIS_PASSWORD,
  ENV.REDIS_DB,
  ENV.REDIS_TLS
);

export default redis;
