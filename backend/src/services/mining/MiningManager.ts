import { Request, Response } from 'express';
import { Redis } from 'ioredis';
import { Task } from '../tasks/task';
import { MiningTaskOptions, ProgressUpdate } from '../tasks/task/types';
import SupabaseTasks from '../../db/supabase/tasks';
import { TaskStatus } from '../../db/types';
import RealtimeSSE from '../../utils/helpers/sseHelpers';
import SSEBroadcasterFactory from '../factory/SSEBroadcasterFactory';
import { flickrBase58IdGenerator } from '../tasks-manager/utils';
import logger from '../../utils/logger';

export interface MiningManagerOptions {
  tasksResolver: SupabaseTasks;
  redisSubscriber: Redis;
  redisPublisher: Redis;
  sseBroadcasterFactory: SSEBroadcasterFactory;
  idGenerator?: (size?: number) => Promise<string>;
}

export interface MiningSource {
  source: string;
  type: 'email' | 'file' | 'pst';
}

export interface RedactedTask {
  userId: string;
  miningId: string;
  miningSource: MiningSource;
  processes: Record<string, string>;
  progress: {
    totalMessages: number;
    fetched: number;
    extracted: number;
    verifiedContacts: number;
    createdContacts: number;
    signatures: number;
  };
}

export default class MiningManager {
  private readonly tasksResolver: SupabaseTasks;

  private readonly redisSubscriber: Redis;

  private readonly redisPublisher: Redis;

  private readonly sseBroadcasterFactory: SSEBroadcasterFactory;

  private readonly idGenerator: () => Promise<string>;

  private readonly activeTasks = new Map<string, Task[]>();

  private readonly sseBroadcasters = new Map<string, RealtimeSSE>();

  public getSSEBroadcasterFactory(): SSEBroadcasterFactory {
    return this.sseBroadcasterFactory;
  }

  public getRedisSubscriber(): Redis {
    return this.redisSubscriber;
  }

  public getRedisPublisher(): Redis {
    return this.redisPublisher;
  }

  constructor(options: MiningManagerOptions) {
    this.tasksResolver = options.tasksResolver;
    this.redisSubscriber = options.redisSubscriber;
    this.redisPublisher = options.redisPublisher;
    this.sseBroadcasterFactory = options.sseBroadcasterFactory;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const generator = options.idGenerator as any;
    this.idGenerator = generator
      ? () => generator()
      : () => flickrBase58IdGenerator()();
  }

  async createTask(
    tasks: Task[],
    userId: string,
    miningSource: MiningSource
  ): Promise<RedactedTask> {
    const miningId = await this.idGenerator();
    const sseBroadcaster = this.sseBroadcasterFactory.create();

    // Initialize tasks with SSE broadcaster
    tasks.forEach((task) => {
      task.onProgress((update: ProgressUpdate) => {
        sseBroadcaster.sendSSE({ miningId, ...update }, 'progress');
      });

      task.onComplete(() => {
        this.checkAllTasksCompleted(miningId);
      });

      task.onError((error: Error) => {
        logger.error(`Task error for mining ${miningId}`, { error });
      });
    });

    this.activeTasks.set(miningId, tasks);
    this.sseBroadcasters.set(miningId, sseBroadcaster);

    // Start all tasks
    await Promise.all(tasks.map((t) => t.start()));

    // Create DB records for each task
    const processIds: Record<string, string> = {};
    for (const task of tasks) {
      const dbTask = await this.tasksResolver.create({
        userId,
        type: task.type,
        category: task.category,
        status: TaskStatus.Running,
        details: { miningId }
      });
      if (dbTask?.id) {
        processIds[task.type] = dbTask.id;
      }
    }

    const redactedTask: RedactedTask = {
      userId,
      miningId,
      miningSource,
      processes: processIds,
      progress: {
        totalMessages: 0,
        fetched: 0,
        extracted: 0,
        verifiedContacts: 0,
        createdContacts: 0,
        signatures: 0
      }
    };

    return redactedTask;
  }

  attachSSE(
    miningId: string,
    connection: { req: Request; res: Response }
  ): void {
    const broadcaster = this.sseBroadcasters.get(miningId);
    if (broadcaster) {
      broadcaster.subscribeSSE(connection);
    }
  }

  async deleteTask(miningId: string): Promise<RedactedTask | null> {
    const tasks = this.activeTasks.get(miningId);
    if (!tasks) return null;

    await Promise.all(tasks.map((t) => t.stop()));

    this.activeTasks.delete(miningId);
    this.sseBroadcasters.delete(miningId);

    // Return a minimal redacted task for cleanup
    return {
      userId: '',
      miningId,
      miningSource: { source: '', type: 'email' },
      processes: {},
      progress: {
        totalMessages: 0,
        fetched: 0,
        extracted: 0,
        verifiedContacts: 0,
        createdContacts: 0,
        signatures: 0
      }
    };
  }

  private checkAllTasksCompleted(miningId: string): void {
    const tasks = this.activeTasks.get(miningId);
    if (!tasks) return;

    const allCompleted = tasks.every((t) => t.hasCompleted());
    if (allCompleted) {
      const broadcaster = this.sseBroadcasters.get(miningId);
      if (broadcaster) {
        broadcaster.sendSSE({ miningId }, 'mining-completed');
      }
    }
  }
}
