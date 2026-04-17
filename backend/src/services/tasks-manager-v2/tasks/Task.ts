import { EventEmitter } from 'events';
import { Redis } from 'ioredis';
import { TaskCategory, TaskStatus, TaskType } from '../types';
import type {
  TaskProgress,
  TaskStreamConfig,
  ProgressMessage,
  StreamDetails,
  StreamCommand
} from '../types';
import SupabaseTasks from '../../../db/supabase/tasks';
import logger from '../../../utils/logger';
import ENV from '../../../config';

export interface TaskConfig {
  id: string;
  type: TaskType;
  category: TaskCategory;
  miningId: string;
  userId: string;
  streams?: TaskStreamConfig;
  config?: Record<string, unknown>;
  passive_mining?: boolean;
}

export class Task extends EventEmitter {
  readonly id: string;

  readonly type: TaskType;

  readonly category: TaskCategory;

  readonly miningId: string;

  readonly userId: string;

  status: TaskStatus = TaskStatus.Running;

  progress: TaskProgress = { total: 0, processed: 0 };

  upstreamDone = false;

  streams?: TaskStreamConfig;

  config: Record<string, unknown>;

  startedAt?: string;

  stoppedAt?: string;

  duration?: number;

  dbId?: string;

  finishedEventName: string;

  constructor(params: TaskConfig) {
    super();
    this.id = params.id;
    this.type = params.type;
    this.category = params.category;
    this.miningId = params.miningId;
    this.userId = params.userId;
    this.streams = params.streams;
    this.config = params.config ?? {};
    if (params.passive_mining !== undefined) {
      this.config.passive_mining = params.passive_mining;
    }
    this.finishedEventName =
      (params.config?.finishedEventName as string) || `${this.id}-finished`;
  }

  protected getStreamConfig(inputOnly = false): {
    input: StreamDetails[];
    output: StreamDetails[];
  } {
    if (!this.streams) {
      return { input: [], output: [] };
    }

    const input = this.streams.input ?? [];
    const output = inputOnly ? [] : (this.streams.output ?? []);

    return { input, output };
  }

  async start(
    tasksResolver: SupabaseTasks,
    redisPublisher?: Redis
  ): Promise<void> {
    const record = await tasksResolver.create({
      userId: this.userId,
      type: this.type,
      category: this.category,
      status: this.status,
      details: this.toDetails() as unknown as Record<string, never>
    });

    this.dbId = record.id;
    this.startedAt = record.startedAt;

    if (redisPublisher && this.streams) {
      const streamConfig = this.getStreamConfig(false);
      if (streamConfig.input.length > 0 || streamConfig.output.length > 0) {
        await redisPublisher.publish(
          ENV.REDIS_PUBSUB_COMMUNICATION_CHANNEL,
          JSON.stringify({
            miningId: this.miningId,
            role: this.streams.role,
            command: 'REGISTER',
            streams: streamConfig
          } as StreamCommand)
        );
      }
    }
  }

  async stop(
    canceled = false,
    tasksResolver?: SupabaseTasks,
    redisPublisher?: Redis
  ): Promise<void> {
    this.stoppedAt = new Date().toUTCString();
    this.status =
      canceled || this.status === TaskStatus.Canceled
        ? TaskStatus.Canceled
        : TaskStatus.Done;

    if (this.startedAt && this.stoppedAt) {
      const start = new Date(this.startedAt).getTime();
      const stop = new Date(this.stoppedAt).getTime();
      this.duration = stop - start;
    }

    if (redisPublisher && this.streams) {
      const streamConfig = this.getStreamConfig(true);
      if (streamConfig.input.length > 0) {
        try {
          await redisPublisher.publish(
            ENV.REDIS_PUBSUB_COMMUNICATION_CHANNEL,
            JSON.stringify({
              miningId: this.miningId,
              role: this.streams.role,
              command: 'DELETE',
              streams: streamConfig
            } as StreamCommand)
          );
        } catch (err) {
          logger.error(`Failed to publish DELETE command for task ${this.id}`, {
            error: err
          });
        }
      }
    }

    if (tasksResolver && this.dbId) {
      try {
        await tasksResolver.update({
          id: this.dbId,
          userId: this.userId,
          type: this.type,
          category: this.category,
          status: this.status,
          details: this.toDetails() as unknown as Record<string, never>,
          stoppedAt: this.stoppedAt,
          startedAt: this.startedAt,
          duration: this.duration
        });
      } catch (error) {
        logger.error(`Failed to update task ${this.id} in database`, {
          error
        });
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, class-methods-use-this
  onMessage(_msg: ProgressMessage): void {
    // Override in subclass
  }

  // eslint-disable-next-line class-methods-use-this
  getProgressMap(): Record<string, number> {
    return {};
  }

  isComplete(): boolean {
    if (this.status !== TaskStatus.Running) return true;
    return this.upstreamDone && this.progress.processed >= this.progress.total;
  }

  toDetails(): Record<string, unknown> {
    return {
      miningId: this.miningId,
      stream: this.streams,
      progress: this.progress,
      ...this.config
    };
  }

  protected emitProgress(key: string, value: number) {
    this.emit('progress', { key, value });
  }
}
