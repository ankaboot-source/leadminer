import { Redis } from 'ioredis';
import {
  MiningSourceType,
  MiningTask,
  RedactedTask,
  TaskProgressType
} from './types';
import BaseTasksManager from './BaseTasksManager';
import ENV from '../../config';
import SupabaseTasks from '../../db/supabase/tasks';
import { TaskCategory, TaskStatus, TaskType } from '../../db/types';
import PSTFetcherClientClass from '../email-fetching/pst';
import SSEBroadcasterFactory from '../factory/SSEBroadcasterFactory';

export default class PstTasksManager extends BaseTasksManager {
  protected readonly sourceType: MiningSourceType = 'pst';

  private readonly fetcherClient: PSTFetcherClientClass;

  constructor(
    tasksResolver: SupabaseTasks,
    redisSubscriber: Redis,
    redisPublisher: Redis,
    PSTFetcherClient: PSTFetcherClientClass,
    sseBroadcasterFactory: SSEBroadcasterFactory,
    idGenerator: () => Promise<string>
  ) {
    super(
      tasksResolver,
      redisSubscriber,
      redisPublisher,
      sseBroadcasterFactory,
      idGenerator
    );
    this.fetcherClient = PSTFetcherClient;
  }

  // eslint-disable-next-line class-methods-use-this
  protected getFetcherClient(): {
    startFetch: (opts: unknown) => Promise<{ data: { totalMessages: number } }>;
    stopFetch: (opts: unknown) => Promise<void>;
  } | null {
    return this.fetcherClient as {
      startFetch: (
        opts: unknown
      ) => Promise<{ data: { totalMessages: number } }>;
      stopFetch: (opts: unknown) => Promise<void>;
    };
  }

  // eslint-disable-next-line class-methods-use-this
  protected getProcessList(): (keyof MiningTask['process'])[] {
    return ['fetch', 'extract', 'clean', 'signature'];
  }

  // eslint-disable-next-line class-methods-use-this
  protected getProgressMappings(): Partial<
    Record<TaskProgressType, keyof MiningTask['process']>
  > {
    return {
      fetched: 'fetch',
      extracted: 'extract',
      createdContacts: 'clean',
      verifiedContacts: 'clean',
      signatures: 'signature'
    };
  }

  async createTask(
    userId: string,
    source: string,
    fetchEmailBody: boolean
  ): Promise<RedactedTask> {
    let miningTaskId: string | null = null;
    try {
      const { miningId, stream } = await this.generateTaskInformation();
      miningTaskId = miningId;
      const {
        messagesStream,
        messagesConsumerGroup,
        emailsStream,
        emailsConsumerGroup
      } = stream;

      const progressHandlerSSE = this.createSSEBroadcaster();

      const miningTask: MiningTask = {
        userId,
        miningId,
        miningSource: { source, type: 'pst' },
        progressHandlerSSE,
        process: {
          signature: {
            userId,
            type: TaskType.Enrich,
            category: TaskCategory.Enriching,
            status: TaskStatus.Running,
            details: {
              miningId,
              enabled: fetchEmailBody,
              stream: { signatureStream: 'email-signature' },
              progress: { signatures: 0 }
            }
          },
          fetch: {
            userId,
            category: TaskCategory.Mining,
            type: TaskType.Fetch,
            status: TaskStatus.Running,
            details: {
              miningId,
              stream: { messagesStream },
              progress: { totalMessages: 0, folders: [], fetched: 0 }
            }
          },
          extract: {
            userId,
            category: TaskCategory.Mining,
            type: TaskType.Extract,
            status: TaskStatus.Running,
            details: {
              miningId,
              stream: {
                messagesStream,
                messagesConsumerGroup,
                emailsVerificationStream: emailsStream
              },
              progress: { extracted: 0 }
            }
          },
          clean: {
            userId,
            category: TaskCategory.Cleaning,
            type: TaskType.Clean,
            status: TaskStatus.Running,
            details: {
              miningId,
              stream: { emailsStream, emailsConsumerGroup },
              progress: { verifiedContacts: 0, createdContacts: 0 }
            }
          }
        },
        progress: {
          totalMessages: 0,
          fetched: 0,
          extracted: 0,
          verifiedContacts: 0,
          createdContacts: 0,
          signatures: 0
        },
        startedAt: performance.now()
      };

      await this.createSubTasks(miningTask);
      this.ACTIVE_MINING_TASKS.set(miningId, miningTask);
      await this.registerStreams(miningId, miningTask);

      const {
        data: { totalMessages }
      } = await this.fetcherClient.startFetch({
        userId,
        miningId,
        source,
        extractSignatures: fetchEmailBody,
        contactStream: messagesStream,
        signatureStream: ENV.REDIS_SIGNATURE_STREAM_NAME
      });

      miningTask.progress.totalMessages = totalMessages;
      miningTask.process.fetch.details.progress.totalMessages = totalMessages;

      this.subscribeToRedis(miningId);
      return this.getActiveTask(miningId);
    } catch (error) {
      if (miningTaskId) {
        await this.deleteTask(miningTaskId, null);
      }
      throw error;
    }
  }

  protected handleStatusUpdates(
    miningId: string,
    progressType: TaskProgressType,
    isCompleted?: boolean,
    isCanceled?: boolean
  ): void {
    const task = this.ACTIVE_MINING_TASKS.get(miningId);
    if (!task) return;

    if (progressType === 'signatures' && isCompleted) {
      task.process.signature.status = TaskStatus.Done;
    }

    if (progressType === 'fetched' && (isCanceled || isCompleted)) {
      task.process.fetch.status = isCanceled
        ? TaskStatus.Canceled
        : TaskStatus.Done;
    }
  }
}
