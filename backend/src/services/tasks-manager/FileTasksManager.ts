import { Request, Response } from 'express';
import { Redis } from 'ioredis';
import MiningManager from '../MiningManager';
import { Task, TaskExtract, TaskClean } from '../../tasks/task';
import { ImapEmailsFetcherOptions } from '../../imap/types';
import ENV from '../../config';
import SupabaseTasks from '../../db/supabase/tasks';
import { TaskCategory, TaskStatus, TaskType } from '../../db/types';
import SSEBroadcasterFactory from '../../factory/SSEBroadcasterFactory';
import { flickrBase58IdGenerator } from '../tasks-manager/utils';
import {
  MiningSourceType,
  MiningTask,
  RedactedTask,
  TaskProgress,
  TaskProgressType
} from './types';

interface FileMiningTask extends Omit<MiningTask, 'process' | 'progress'> {
  process: {
    extract: MiningTask['process']['extract'];
    clean: MiningTask['process']['clean'];
  };
  progress: {
    totalImported: number;
    extracted: number;
    verifiedContacts: number;
    createdContacts: number;
  };
}

export default class FileTasksManager {
  private readonly miningManager: MiningManager;

  constructor(
    tasksResolver: SupabaseTasks,
    redisSubscriber: Redis,
    redisPublisher: Redis,
    _emailFetcherFactory: unknown,
    sseBroadcasterFactory: SSEBroadcasterFactory,
    _idGenerator: () => Promise<string>
  ) {
    this.miningManager = new MiningManager({
      tasksResolver,
      redisSubscriber,
      redisPublisher,
      sseBroadcasterFactory,
      idGenerator: () => flickrBase58IdGenerator()()
    });
  }

  protected getProgressMappings(): Partial<
    Record<TaskProgressType, keyof FileMiningTask['process']>
  > {
    return {
      extracted: 'extract',
      createdContacts: 'clean',
      verifiedContacts: 'clean'
    };
  }

  async createTask(
    userId: string,
    fileName: string,
    totalImportedFromFile: number
  ): Promise<RedactedTask> {
    const miningId = await flickrBase58IdGenerator()();
    const sseBroadcaster = this.miningManager
      .getSSEBroadcasterFactory()
      .create();
    const messagesStream = `messages_stream-${miningId}`;
    const emailsStream = `emails_stream-${miningId}`;

    const tasks: Task[] = [
      new TaskExtract(
        {
          miningId,
          userId,
          redisSubscriber: this.miningManager.getRedisSubscriber(),
          redisPublisher: this.miningManager.getRedisPublisher(),
          streamName: messagesStream,
          consumerGroup: ENV.REDIS_EXTRACTING_STREAM_CONSUMER_GROUP
        },
        sseBroadcaster
      ),
      new TaskClean(
        {
          miningId,
          userId,
          redisSubscriber: this.miningManager.getRedisSubscriber(),
          redisPublisher: this.miningManager.getRedisPublisher(),
          streamName: emailsStream,
          consumerGroup: ENV.REDIS_CLEANING_STREAM_CONSUMER_GROUP
        },
        sseBroadcaster
      )
    ];

    const result = await this.miningManager.createTask(tasks, userId, {
      source: fileName,
      type: 'file'
    });

    return {
      miningId: result.miningId,
      miningSource: { source: fileName, type: 'file' as MiningSourceType },
      userId: result.userId,
      processes: result.processes,
      progress: {
        ...result.progress,
        totalImported: totalImportedFromFile
      }
    };
  }

  getActiveTask(miningId: string): RedactedTask {
    const tasks = (this.miningManager as any).activeTasks.get(miningId);
    if (!tasks) {
      throw new Error(`Mining task ${miningId} not found`);
    }
    return {
      miningId,
      miningSource: { source: '', type: 'file' },
      userId: '',
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

  attachSSE(
    miningId: string,
    connection: { req: Request; res: Response }
  ): void {
    this.miningManager.attachSSE(miningId, connection);
  }

  async deleteTask(
    miningId: string,
    _processIds: string[] | null
  ): Promise<RedactedTask> {
    const result = await this.miningManager.deleteTask(miningId);
    if (!result) {
      throw new Error(`Mining task ${miningId} not found`);
    }
    return {
      miningId: result.miningId,
      miningSource: result.miningSource,
      userId: result.userId,
      processes: result.processes,
      progress: result.progress
    };
  }
}
