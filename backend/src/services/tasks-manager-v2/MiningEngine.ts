import { Redis } from 'ioredis';
import { Request, Response } from 'express';
import { Pipeline } from './Pipeline';
import type { PipelineDeps } from './Pipeline';
import { TaskId } from './types';
import { ExtractTask } from './tasks/ExtractTask';
import logger from '../../utils/logger';
import {
  createImapMining,
  createFileMining,
  createPstMining
} from './factories';
import type { FetcherClient } from './tasks/FetchTask';
import type { RedactedTask } from './types';
import SupabaseTasks from '../../db/supabase/tasks';
import SSEBroadcasterFactory from '../factory/SSEBroadcasterFactory';

export interface MiningEngineDeps {
  tasksResolver: SupabaseTasks;
  redisSubscriber: Redis;
  redisPublisher: Redis;
  sseBroadcasterFactory: SSEBroadcasterFactory;
  idGenerator: () => Promise<string>;
  emailFetcherClient: FetcherClient;
  pstFetcherClient: FetcherClient;
}

export interface CreateImapTaskOptions {
  userId: string;
  email: string;
  boxes: string[];
  fetchEmailBody: boolean;
  passiveMining?: boolean;
  since?: string;
  cleaningEnabled: boolean;
}

export interface CreateFileTaskOptions {
  userId: string;
  fileName: string;
  totalImported: number;
  cleaningEnabled: boolean;
}

export interface CreatePstTaskOptions {
  userId: string;
  source: string;
  fetchEmailBody: boolean;
  cleaningEnabled: boolean;
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

  private makeManagerDeps(): PipelineDeps {
    return {
      tasksResolver: this.deps.tasksResolver,
      redisPublisher: this.deps.redisPublisher,
      sseBroadcasterFactory: this.deps.sseBroadcasterFactory
    };
  }

  private removePipeline(miningId: string): void {
    this.deps.redisSubscriber.unsubscribe(miningId);
    this.pipelines.delete(miningId);
  }

  private async registerAndStart(
    miningId: string,
    pipeline: Pipeline
  ): Promise<RedactedTask> {
    this.pipelines.set(miningId, pipeline);
    this.deps.redisSubscriber.subscribe(miningId);
    pipeline.onComplete = async () => {
      this.removePipeline(miningId);
    };
    try {
      await pipeline.start();
      return pipeline.getActiveTask();
    } catch (error) {
      this.removePipeline(miningId);
      throw error;
    }
  }

  async createImapTask(opts: CreateImapTaskOptions): Promise<RedactedTask> {
    const miningId = await this.deps.idGenerator();
    const manager = createImapMining(
      {
        miningId,
        userId: opts.userId,
        email: opts.email,
        boxes: opts.boxes,
        fetchEmailBody: opts.fetchEmailBody,
        passiveMining: opts.passiveMining,
        since: opts.since,
        cleaningEnabled: opts.cleaningEnabled,
        fetcherClient: this.deps.emailFetcherClient
      },
      this.makeManagerDeps()
    );
    return this.registerAndStart(miningId, manager);
  }

  async createFileTask(opts: CreateFileTaskOptions): Promise<RedactedTask> {
    const miningId = await this.deps.idGenerator();
    const manager = createFileMining(
      {
        miningId,
        userId: opts.userId,
        fileName: opts.fileName,
        totalImported: opts.totalImported,
        cleaningEnabled: opts.cleaningEnabled
      },
      this.makeManagerDeps()
    );
    return this.registerAndStart(miningId, manager);
  }

  async createPstTask(opts: CreatePstTaskOptions): Promise<RedactedTask> {
    const miningId = await this.deps.idGenerator();
    const manager = createPstMining(
      {
        miningId,
        userId: opts.userId,
        source: opts.source,
        fetchEmailBody: opts.fetchEmailBody,
        cleaningEnabled: opts.cleaningEnabled,
        fetcherClient: this.deps.pstFetcherClient
      },
      this.makeManagerDeps()
    );
    return this.registerAndStart(miningId, manager);
  }

  getActiveTask(miningId: string): RedactedTask {
    return this.getPipeline(miningId).getActiveTask();
  }

  getPipeline(miningId: string): Pipeline {
    const pipeline = this.pipelines.get(miningId);
    if (!pipeline) {
      throw new Error(`Task with mining ID ${miningId} does not exist.`);
    }
    return pipeline;
  }

  attachSSE(
    miningId: string,
    connection: { req: Request; res: Response }
  ): void {
    this.getPipeline(miningId).attachSSE(connection);
  }

  async deleteTask(
    miningId: string,
    processIds: string[] | null
  ): Promise<RedactedTask> {
    const pipeline = this.getPipeline(miningId);
    const result = await pipeline.cancel(processIds ?? undefined);
    return result;
  }
}
