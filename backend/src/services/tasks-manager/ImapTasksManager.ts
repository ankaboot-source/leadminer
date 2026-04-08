import { Request, Response } from 'express';
import { Redis } from 'ioredis';
import MiningManager, {
  MiningSource,
  RedactedTask as NewRedactedTask
} from '../MiningManager';
import {
  Task,
  TaskFetch,
  TaskExtract,
  TaskClean,
  TaskSignature
} from '../../tasks/task';
import { EmailFetcherAdapter } from '../../tasks/fetcher/EmailFetcherAdapter';
import { ImapEmailsFetcherOptions } from '../../imap/types';
import ENV from '../../config';
import SupabaseTasks from '../../db/supabase/tasks';
import { TaskCategory, TaskStatus, TaskType } from '../../db/types';
import EmailFetcherClient from '../../email-fetching';
import SSEBroadcasterFactory from '../../factory/SSEBroadcasterFactory';
import { flickrBase58IdGenerator } from '../tasks-manager/utils';
import {
  MiningSourceType,
  MiningTask,
  RedactedTask,
  TaskProgressType
} from './types';

export default class ImapTasksManager {
  private readonly miningManager: MiningManager;
  private readonly fetcherClient: EmailFetcherClient;

  constructor(
    tasksResolver: SupabaseTasks,
    redisSubscriber: Redis,
    redisPublisher: Redis,
    emailFetcherAPI: EmailFetcherClient,
    sseBroadcasterFactory: SSEBroadcasterFactory,
    _idGenerator: () => Promise<string>
  ) {
    this.fetcherClient = emailFetcherAPI;
    this.miningManager = new MiningManager({
      tasksResolver,
      redisSubscriber,
      redisPublisher,
      sseBroadcasterFactory,
      idGenerator: () => flickrBase58IdGenerator()()
    });
  }

  async createTask(
    options: ImapEmailsFetcherOptions,
    passive_mining = false
  ): Promise<RedactedTask> {
    const { email, boxes, fetchEmailBody, userId, since } = options;
    const miningId = await flickrBase58IdGenerator()();
    const sseBroadcaster = this.miningManager.getSSEBroadcasterFactory().create();
    const messagesStream = `messages_stream-${miningId}`;
    const emailsStream = `emails_stream-${miningId}`;

    const emailFetcher = new EmailFetcherAdapter(this.fetcherClient);

    const tasks: Task[] = [
      new TaskFetch(
        {
          miningId,
          userId,
          fetchers: [emailFetcher],
          contactStream: messagesStream,
          signatureStream: ENV.REDIS_SIGNATURE_STREAM_NAME,
          extractSignatures: fetchEmailBody
        },
        sseBroadcaster
      ),
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
      ),
      new TaskSignature({ miningId, userId }, sseBroadcaster)
    ];

    const result = await this.miningManager.createTask(tasks, userId, {
      source: email,
      type: 'email'
    });

    return {
      miningId: result.miningId,
      miningSource: { source: email, type: 'email' as MiningSourceType },
      userId: result.userId,
      processes: result.processes,
      progress: result.progress,
      passive_mining
    };
  }

  getActiveTask(miningId: string): RedactedTask {
    const tasks = (this.miningManager as any).activeTasks.get(miningId);
    if (!tasks) {
      throw new Error(`Mining task ${miningId} not found`);
    }
    return {
      miningId,
      miningSource: { source: '', type: 'email' },
      userId: '',
      processes: {},
      progress: { totalMessages: 0, fetched: 0, extracted: 0, verifiedContacts: 0, createdContacts: 0, signatures: 0 }
    };
  }

  attachSSE(miningId: string, connection: { req: Request; res: Response }): void {
    this.miningManager.attachSSE(miningId, connection);
  }

  async deleteTask(miningId: string, _processIds: string[] | null): Promise<RedactedTask> {
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

  getActiveTask(miningId: string): RedactedTask {
    const tasks = (this.miningManager as any).activeTasks.get(miningId);
    if (!tasks) {
      throw new Error(`Mining task ${miningId} not found`);
    }
    return {
      miningId,
      miningSource: { source: '', type: 'email' },
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
