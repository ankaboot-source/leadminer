import { Redis } from 'ioredis';
import Publisher from '../Publisher';

export default class RedisPublisher<T> implements Publisher<T> {
  constructor(private readonly redisClient: Redis) {}

  async publish(channel: string, data: T): Promise<void> {
    await this.redisClient.publish(channel, JSON.stringify(data));
  }
}
