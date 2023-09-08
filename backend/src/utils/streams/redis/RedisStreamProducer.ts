import { Redis } from 'ioredis';
import { Logger } from 'winston';
import StreamProducer from '../StreamProducer';

export default class RedisStreamProducer<T> implements StreamProducer<T> {
  constructor(
    private readonly redisClient: Redis,
    private readonly streamName: string,
    private readonly logger: Logger
  ) {}

  async produce(data: T[]): Promise<void> {
    try {
      const pipeline = this.redisClient.pipeline();
      for (const item of data) {
        pipeline.xadd(this.streamName, '*', 'message', JSON.stringify(item));
      }
      await pipeline.exec();
    } catch (error) {
      this.logger.error(
        `Error when publishing message to stream ${this.streamName}`,
        error,
        data
      );
      throw error;
    }
  }
}
