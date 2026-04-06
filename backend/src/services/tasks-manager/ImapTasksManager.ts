import { AxiosError } from 'axios';
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
import EmailFetcherClient from '../email-fetching';
import SSEBroadcasterFactory from '../factory/SSEBroadcasterFactory';
import { ImapEmailsFetcherOptions } from '../imap/types';

export default class ImapTasksManager extends BaseTasksManager {
  protected readonly sourceType: MiningSourceType = 'email';

  private readonly fetcherClient: EmailFetcherClient;

  constructor(
    tasksResolver: SupabaseTasks,
    redisSubscriber: Redis,
    redisPublisher: Redis,
    emailFetcherAPI: EmailFetcherClient,
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
    this.fetcherClient = emailFetcherAPI;
  }

  // eslint-disable-next-line class-methods-use-this
  protected getFetcherClient(): {
    startFetch: (opts: unknown) => Promise<{ data: { totalMessages: number } }>;
    stopFetch: (opts: unknown) => Promise<void>;
  } | null {
    return this.fetcherClient;
  }

  // eslint-disable-next-line class-methods-use-this
  protected getProcessList() {
    return ['fetch', 'extract', 'clean', 'signature'] as const;
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
    { email, boxes, fetchEmailBody, userId, since }: ImapEmailsFetcherOptions,
    passive_mining = false
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
        miningSource: { source: email, type: 'email' },
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
              progress: { signatures: 0 },
              passive_mining
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
              progress: { totalMessages: 0, folders: boxes, fetched: 0 },
              passive_mining
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
              progress: { extracted: 0 },
              passive_mining
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
              progress: { verifiedContacts: 0, createdContacts: 0 },
              passive_mining
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

      try {
        const {
          data: { totalMessages }
        } = await this.fetcherClient.startFetch({
          boxes,
          userId,
          email,
          miningId,
          contactStream: messagesStream,
          signatureStream: ENV.REDIS_SIGNATURE_STREAM_NAME,
          extractSignatures: fetchEmailBody,
          since
        });

        miningTask.progress.totalMessages = totalMessages;
        miningTask.process.fetch.details.progress.totalMessages = totalMessages;
      } catch (error) {
        if (error instanceof AxiosError) {
          throw new Error(`Failed to start fetching: ${error.message}`);
        }
        throw new Error('Failed to start fetching');
      }

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
