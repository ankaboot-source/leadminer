import { Redis } from 'ioredis';
import { TaskStatus } from '../../../db/types';
import Task from './Task';
import { MiningTaskOptions } from './types';
import RealtimeSSE from '../../../utils/helpers/sseHelpers';
import ENV from '../../../config';
import logger from '../../../utils/logger';

export interface RedisTaskOptions extends MiningTaskOptions {
  redisSubscriber: Redis;
  redisPublisher: Redis;
  streamName: string;
  consumerGroup: string;
}

export default abstract class RedisTask extends Task {
  protected readonly redisSubscriber: Redis;

  protected readonly redisPublisher: Redis;

  protected readonly streamName: string;

  protected readonly consumerGroup: string;

  private messageHandler: ((channel: string, message: string) => void) | null =
    null;

  constructor(options: RedisTaskOptions, sseBroadcaster: RealtimeSSE) {
    super(options, sseBroadcaster);
    this.redisSubscriber = options.redisSubscriber;
    this.redisPublisher = options.redisPublisher;
    this.streamName = options.streamName;
    this.consumerGroup = options.consumerGroup;
  }

  protected async createStream(): Promise<void> {
    await this.redisPublisher.xgroup(
      'CREATE',
      this.streamName,
      this.consumerGroup,
      '$',
      'MKSTREAM'
    );
  }

  protected async destroyStream(): Promise<void> {
    await this.redisPublisher.xgroup(
      'DESTROY',
      this.streamName,
      this.consumerGroup
    );
    await this.redisPublisher.del(this.streamName);
  }

  protected subscribeToRedis(): void {
    this.messageHandler = async (channel: string, data: string) => {
      if (channel !== this.miningId) return;

      try {
        const message = JSON.parse(data);
        await this.handleRedisMessage(message);
      } catch (error) {
        logger.warn('Ignoring malformed Redis message', { data, error });
      }
    };

    this.redisSubscriber.subscribe(this.miningId, (err) => {
      if (err) {
        logger.error('Failed to subscribe to Redis', {
          miningId: this.miningId,
          err
        });
      }
    });
    this.redisSubscriber.on('message', this.messageHandler);
  }

  protected unsubscribeFromRedis(): void {
    if (this.messageHandler) {
      this.redisSubscriber.off('message', this.messageHandler);
      this.redisSubscriber.unsubscribe(this.miningId);
      this.messageHandler = null;
    }
  }

  protected async publishMessage(message: object): Promise<void> {
    await this.redisPublisher.publish(
      ENV.REDIS_PUBSUB_COMMUNICATION_CHANNEL,
      JSON.stringify(message)
    );
  }

  protected abstract handleRedisMessage(message: {
    progressType?: string;
    count?: number;
    isCompleted?: boolean;
    isCanceled?: boolean;
  }): Promise<void>;

  public async stop(): Promise<void> {
    this.unsubscribeFromRedis();
    await this.destroyStream();
    this.status = TaskStatus.Canceled;
  }
}
