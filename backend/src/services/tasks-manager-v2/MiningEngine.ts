import { Redis } from 'ioredis';
import { Pipeline } from './Pipeline';
import logger from '../../utils/logger';
import type { RedactedTask } from './types';

export interface MiningEngineDeps {
  redisSubscriber: Redis;
}

export class MiningEngine {
  private pipelines: Map<string, Pipeline> = new Map();

  private messageHandler = (channel: string, data: string) => {
    const pipeline = this.pipelines.get(channel);
    if (pipeline) {
      try {
        pipeline.onMessage(data);
      } catch (error) {
        logger.error(`Error processing message for mining ${channel}`, {
          error
        });
      }
    }
  };

  constructor(private deps: MiningEngineDeps) {
    this.deps.redisSubscriber.on('message', this.messageHandler);
  }

  public destroy(): void {
    this.deps.redisSubscriber.off('message', this.messageHandler);
  }

  private remove(miningId: string): void {
    this.deps.redisSubscriber.unsubscribe(miningId).catch((err) => {
      logger.error(`Failed to unsubscribe from channel ${miningId}`, err);
    });
    this.pipelines.delete(miningId);
  }

  public async submit(pipeline: Pipeline): Promise<RedactedTask> {
    const { miningId } = pipeline;
    this.pipelines.set(miningId, pipeline);
    this.deps.redisSubscriber.subscribe(miningId);

    const originalOnComplete = pipeline.onComplete;
    // eslint-disable-next-line no-param-reassign
    pipeline.onComplete = async () => {
      this.remove(miningId);
      if (originalOnComplete) {
        await originalOnComplete();
      }
    };

    try {
      await pipeline.start();
      return pipeline.getActiveTask();
    } catch (error) {
      this.remove(miningId);
      throw error;
    }
  }

  public getPipeline(miningId: string): Pipeline {
    const pipeline = this.pipelines.get(miningId);
    if (!pipeline) {
      throw new Error(`Task with mining ID ${miningId} does not exist.`);
    }
    return pipeline;
  }

  public terminate(
    miningId: string,
    processIds?: string[]
  ): Promise<RedactedTask> {
    const pipeline = this.getPipeline(miningId);
    return pipeline.cancel(processIds);
  }
}
