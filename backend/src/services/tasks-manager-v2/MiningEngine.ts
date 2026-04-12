import { Redis } from 'ioredis';
import { Pipeline } from './Pipeline';
import logger from '../../utils/logger';
import type { RedactedTask } from './types';

export interface MiningEngineDeps {
  redisSubscriber: Redis;
}

export class MiningEngine {
  private pipelines: Map<string, Pipeline> = new Map();

  constructor(private deps: MiningEngineDeps) {
    this.deps.redisSubscriber.on('message', (channel: string, data: string) => {
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
    });
  }

  private remove(miningId: string): void {
    this.deps.redisSubscriber.unsubscribe(miningId);
    this.pipelines.delete(miningId);
  }

  public async submit(pipeline: Pipeline): Promise<RedactedTask> {
    const miningId = pipeline.miningId;
    this.pipelines.set(miningId, pipeline);
    this.deps.redisSubscriber.subscribe(miningId);
    pipeline.onComplete = async () => {
      this.remove(miningId);
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

  public async terminate(
    miningId: string,
    processIds?: string[]
  ): Promise<RedactedTask> {
    const pipeline = this.getPipeline(miningId);
    return await pipeline.cancel(processIds);
  }
}
