import { Redis } from 'ioredis';
import { Logger } from 'winston';
import { errorMeta } from '../../errors';
import Subscriber from '../Subscriber';

export default class RedisSubscriber<T> implements Subscriber<T> {
  constructor(
    private readonly redisClient: Redis,
    private readonly logger: Logger,
    private readonly channel: string
  ) {}

  subscribe(onMessage: (data: T) => void | Promise<void>) {
    this.logger.info(
      `Attempting to subscribe to redis channel ${this.channel}`
    );
    try {
      this.redisClient.subscribe(this.channel, (err) => {
        if (err) {
          this.logger.error('Failed subscribing to Redis.', {
            error: errorMeta(err)
          });
          return;
        }
        this.logger.info(`Subscribed to redis channel ${this.channel}`);
      });
      this.redisClient.on('message', (_, data: string) => {
        try {
          onMessage(JSON.parse(data) as T);
        } catch (error) {
          this.logger.warn(
            `Ignoring malformed Redis message on channel ${this.channel}`,
            { error: errorMeta(error) }
          );
        }
      });
    } catch (error) {
      this.logger.error(`Failed subscribing to redis channel ${this.channel}`, {
        error: errorMeta(error)
      });
    }
  }

  async unsubscribe() {
    try {
      await this.redisClient.unsubscribe(this.channel);
      this.logger.info(`Unsubscribed from redis channel ${this.channel}`);
    } catch (error) {
      this.logger.error(
        `Failed unsubscribing from redis channel ${this.channel}`,
        error
      );
    }
  }
}
