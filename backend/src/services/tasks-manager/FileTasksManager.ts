import { Redis } from 'ioredis';
import {
  MiningSourceType,
  MiningTask,
  RedactedTask,
  TaskProgress,
  TaskProgressType
} from './types';
import BaseTasksManager from './BaseTasksManager';
import SupabaseTasks from '../../db/supabase/tasks';
import { TaskCategory, TaskStatus, TaskType } from '../../db/types';
import SSEBroadcasterFactory from '../factory/SSEBroadcasterFactory';

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

export default class FileTasksManager extends BaseTasksManager {
  protected readonly sourceType: MiningSourceType = 'file';

  // eslint-disable-next-line no-unused-vars
  constructor(
    tasksResolver: SupabaseTasks,
    redisSubscriber: Redis,
    redisPublisher: Redis,
    _emailFetcherFactory: unknown,
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
  }

  // eslint-disable-next-line class-methods-use-this
  protected getFetcherClient(): null {
    return null;
  }

  // eslint-disable-next-line class-methods-use-this
  protected getProcessList() {
    return ['extract', 'clean'] as const;
  }

  // eslint-disable-next-line class-methods-use-this
  protected getProgressMappings(): Partial<
    Record<TaskProgressType, keyof MiningTask['process']>
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
    const { miningId, stream } = await this.generateTaskInformation();
    const {
      messagesStream,
      messagesConsumerGroup,
      emailsStream,
      emailsConsumerGroup
    } = stream;

    const progressHandlerSSE = this.createSSEBroadcaster();

    const miningTask: FileMiningTask = {
      userId,
      miningId,
      miningSource: { source: fileName, type: 'file' },
      progressHandlerSSE,
      process: {
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
        totalImported: totalImportedFromFile,
        extracted: 0,
        verifiedContacts: 0,
        createdContacts: 0
      },
      startedAt: performance.now()
    };

    await this.createSubTasks(miningTask as unknown as MiningTask);
    this.ACTIVE_MINING_TASKS.set(miningId, miningTask as unknown as MiningTask);
    await this.registerStreams(miningId, miningTask as unknown as MiningTask);

    this.subscribeToRedis(miningId);
    return this.getActiveTask(miningId);
  }

  protected notifyChanges(
    miningId: string,
    progressType: TaskProgressType,
    event: string | null = null
  ): void {
    const task = this.ACTIVE_MINING_TASKS.get(miningId) as
      | FileMiningTask
      | undefined;
    if (!task?.progressHandlerSSE) return;

    const { progressHandlerSSE, process } = task;

    const progress: TaskProgress = {
      totalMessages: 0,
      fetched: 0,
      extracted: 0,
      verifiedContacts: 0,
      createdContacts: 0,
      signatures: 0
    };

    Object.assign(progress, process.extract.details.progress);
    Object.assign(progress, process.clean.details.progress);

    const value = progress[`${progressType}` as keyof TaskProgress];
    const eventName = event ?? `${progressType}-${miningId}`;
    progressHandlerSSE.sendSSE(value, eventName);
  }

  // eslint-disable-next-line class-methods-use-this
  protected async checkProcessCompletion(
    miningId: string,
    task: MiningTask,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _processList: (keyof MiningTask['process'])[]
  ): Promise<void> {
    const fileTask = task as FileMiningTask;
    const progress: TaskProgress = {
      totalMessages: 0,
      fetched: 0,
      extracted: 0,
      verifiedContacts: 0,
      createdContacts: 0,
      signatures: 0
    };

    Object.assign(progress, fileTask.process.extract.details.progress);
    Object.assign(progress, fileTask.process.clean.details.progress);

    const { totalImported } = fileTask.progress;

    if (
      fileTask.process.extract &&
      !fileTask.process.extract.stoppedAt &&
      progress.extracted >= totalImported
    ) {
      await this.stopTask([fileTask.process.extract]);
      this.notifyChanges(miningId, 'extracted', 'extracting-finished');
    }

    if (
      fileTask.process.clean &&
      !fileTask.process.clean.stoppedAt &&
      fileTask.process.extract?.stoppedAt &&
      progress.verifiedContacts >= progress.createdContacts
    ) {
      await this.stopTask([fileTask.process.clean]);
      this.notifyChanges(miningId, 'verifiedContacts', 'cleaning-finished');
    }
  }
}
