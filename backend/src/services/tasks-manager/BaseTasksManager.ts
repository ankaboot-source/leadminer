/* eslint-disable max-classes-per-file */

import { Request, Response } from 'express';
import { Redis } from 'ioredis';
import {
  MiningSourceType,
  MiningTask,
  RedactedTask,
  RedisCommand,
  StreamInfo,
  Task,
  TaskProgress,
  TaskProgressType
} from './types';
import ENV from '../../config';
import { mailMiningComplete, refineContacts } from '../../db/mail';
import SupabaseTasks from '../../db/supabase/tasks';
import logger from '../../utils/logger';
import SSEBroadcasterFactory from '../factory/SSEBroadcasterFactory';
import { redactSensitiveData } from './utils';
import { TaskStatus } from '../../db/types';

export default abstract class BaseTasksManager {
  protected readonly ACTIVE_MINING_TASKS = new Map<string, MiningTask>();

  constructor(
    protected readonly tasksResolver: SupabaseTasks,
    protected readonly redisSubscriber: Redis,
    protected readonly redisPublisher: Redis,
    protected readonly sseBroadcasterFactory: SSEBroadcasterFactory,
    protected readonly idGenerator: () => Promise<string>
  ) {
    this.setupRedisSubscriber();
  }

  protected abstract readonly sourceType: MiningSourceType;

  // eslint-disable-next-line class-methods-use-this
  protected abstract getFetcherClient(): {
    startFetch: (opts: unknown) => Promise<{ data: { totalMessages: number } }>;
    stopFetch: (opts: unknown) => Promise<void>;
  } | null;

  // eslint-disable-next-line class-methods-use-this
  protected abstract getProcessList(): (keyof MiningTask['process'])[];

  protected generateMiningId() {
    return this.idGenerator();
  }

  protected async generateTaskInformation() {
    const miningId = await this.generateMiningId();

    return {
      miningId,
      stream: {
        messagesStream: `messages_stream-${miningId}`,
        emailsStream: `emails_stream-${miningId}`,
        messagesConsumerGroup: ENV.REDIS_EXTRACTING_STREAM_CONSUMER_GROUP,
        emailsConsumerGroup: ENV.REDIS_CLEANING_STREAM_CONSUMER_GROUP
      }
    };
  }

  protected createSSEBroadcaster() {
    return this.sseBroadcasterFactory.create();
  }

  protected async createSubTasks(task: MiningTask) {
    const processList = this.getProcessList();
    const createdTasks = await Promise.all(
      processList.map((key) => this.tasksResolver.create(task.process[key]))
    );

    processList.forEach((key, index) => {
      const createdTask = task.process[key];
      createdTask.id = createdTasks[index].id;
      createdTask.startedAt = createdTasks[index].startedAt;
    });
  }

  protected async registerStreams(miningId: string, task: MiningTask) {
    const processList = this.getProcessList();
    const processesToRegister = processList
      .filter((key) => {
        const process = task.process[key];
        return (
          process.details?.stream?.emailsStream ||
          process.details?.stream?.messagesConsumerGroup
        );
      })
      .map((key) => task.process[key]);

    await Promise.all(
      processesToRegister.map((p) =>
        this.pubsubSendMessage(miningId, 'REGISTER', p.details.stream)
      )
    );
  }

  protected subscribeToRedis(miningId: string) {
    this.redisSubscriber.subscribe(miningId, (err) => {
      if (err) {
        logger.error('Failed subscribing to Redis.', err);
      }
    });
  }

  private setupRedisSubscriber() {
    this.redisSubscriber.on('message', async (_channel, data) => {
      let message: {
        miningId?: string;
        progressType?: TaskProgressType;
        count?: number;
        isCompleted?: boolean;
        isCanceled?: boolean;
      };

      try {
        message = JSON.parse(data);
      } catch (error) {
        logger.warn('Ignoring malformed Redis progress payload.', {
          data,
          error
        });
        return;
      }

      const { miningId, progressType, count, isCompleted, isCanceled } =
        message;

      if (!miningId || !progressType || typeof count !== 'number') {
        logger.warn('Ignoring incomplete Redis progress payload.', { data });
        return;
      }

      this.handleStatusUpdates(miningId, progressType, isCompleted, isCanceled);

      if (count > 0) {
        this.updateProgress(miningId, progressType, count);
        this.notifyChanges(miningId, progressType);
      }
      await this.hasCompleted(miningId);
    });
  }

  // eslint-disable-next-line class-methods-use-this
  protected handleStatusUpdates(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _miningId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _progressType: TaskProgressType,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _isCompleted?: boolean,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _isCanceled?: boolean
  ): void {
    // Override in subclass if needed
  }

  getTaskOrThrow(miningId: string): MiningTask {
    const task = this.ACTIVE_MINING_TASKS.get(miningId);
    if (!task) {
      throw new Error(`Task with mining ID ${miningId} does not exist.`);
    }
    return task;
  }

  getActiveTask(miningId: string): RedactedTask {
    const task = this.getTaskOrThrow(miningId);
    return redactSensitiveData(task);
  }

  attachSSE(miningId: string, connection: { req: Request; res: Response }) {
    const task = this.getTaskOrThrow(miningId);
    task.progressHandlerSSE.subscribeSSE(connection);
  }

  protected static logTaskCompletion(
    startedAt: number,
    progress: TaskProgress
  ): void {
    const duration = ((performance.now() - startedAt) / 1000).toFixed(2);
    logger.info(`Mining task completed in ${duration} seconds`, progress);
  }

  protected static calculateTaskDuration(
    startedAt: string,
    stoppedAt: string
  ): number {
    const start = new Date(startedAt).getTime();
    const stop = new Date(stoppedAt).getTime();
    return stop - start;
  }

  async deleteTask(
    miningId: string,
    processIds: string[] | null
  ): Promise<RedactedTask> {
    if (processIds && !Array.isArray(processIds)) {
      throw new Error('processIds must be an array of strings');
    }
    const task = this.getTaskOrThrow(miningId);
    const { progressHandlerSSE, startedAt, progress } = task;

    try {
      const endEntireTask = !processIds || processIds.length === 0;
      const processList = this.getProcessList();
      const processesToStop = processList
        .map((key) => task.process[key])
        .filter((p) =>
          endEntireTask
            ? !p.stoppedAt
            : !p.stoppedAt && p.id && processIds?.includes(p.id)
        );

      if (processesToStop.length) {
        await this.stopTask(processesToStop, true);
      }

      if (this.isTaskCompleted(task)) {
        try {
          await refineContacts(task.userId);
          await mailMiningComplete(miningId);
        } catch (err) {
          logger.error(
            'Failed to trigger email notification, refine contacts',
            err
          );
        } finally {
          this.ACTIVE_MINING_TASKS.delete(miningId);
          progressHandlerSSE.sendSSE('mining-completed', 'mining-completed');
          progressHandlerSSE.stop();
        }
      }
    } catch (error) {
      logger.error('Error when deleting task', error);
    }

    BaseTasksManager.logTaskCompletion(startedAt, progress);
    return redactSensitiveData(task);
  }

  protected isTaskCompleted(task: MiningTask): boolean {
    const processList = this.getProcessList();
    return processList.every((key) => task.process[key]?.stoppedAt != null);
  }

  // eslint-disable-next-line no-param-reassign
  protected async stopTask(tasks: Task[], canceled = false): Promise<void> {
    const stopPromises = tasks.map(async (taskToStop) => {
      // eslint-disable-next-line no-param-reassign
      taskToStop.stoppedAt = new Date().toUTCString();

      if (taskToStop.duration === undefined && taskToStop.startedAt) {
        // eslint-disable-next-line no-param-reassign
        taskToStop.duration = BaseTasksManager.calculateTaskDuration(
          taskToStop.startedAt,
          taskToStop.stoppedAt
        );
      }
      // eslint-disable-next-line no-param-reassign
      taskToStop.status = canceled ? TaskStatus.Canceled : TaskStatus.Done;

      try {
        if (taskToStop.type === 'fetch') {
          const fetcher = this.getFetcherClient();
          if (fetcher) {
            await fetcher.stopFetch({
              miningId: taskToStop.details.miningId,
              canceled: taskToStop.status === TaskStatus.Canceled
            });
          }
        }

        await this.pubsubSendMessage(
          taskToStop.details.miningId,
          'DELETE',
          taskToStop.details.stream
        );
        await this.tasksResolver.update(taskToStop);
      } catch (error) {
        logger.error(
          `Failed to stop current active task with id: ${taskToStop.details.miningId}`,
          { error }
        );
      }
    });

    await Promise.all(stopPromises);
  }

  protected notifyChanges(
    miningId: string,
    progressType: TaskProgressType,
    event: string | null = null
  ): void {
    const task = this.ACTIVE_MINING_TASKS.get(miningId);

    if (!task?.progressHandlerSSE) return;

    const { progressHandlerSSE, process } = task;
    const processList = this.getProcessList();

    const progress: TaskProgress = {
      totalMessages: 0,
      fetched: 0,
      extracted: 0,
      verifiedContacts: 0,
      createdContacts: 0,
      signatures: 0
    };

    processList.forEach((key) => {
      const p = process[key];
      if (p?.details?.progress) {
        Object.assign(progress, p.details.progress);
      }
    });

    const value = progress[`${progressType}` as keyof TaskProgress];
    const eventName = event ?? `${progressType}-${miningId}`;
    progressHandlerSSE.sendSSE(value, eventName);
  }

  protected updateProgress(
    miningId: string,
    progressType: TaskProgressType,
    incrementBy = 1
  ): TaskProgress | undefined {
    const task = this.ACTIVE_MINING_TASKS.get(miningId);
    if (!task) return undefined;

    const { progress, process } = task;
    const mappings = this.getProgressMappings();
    const taskProperty = mappings[progressType];

    if (taskProperty) {
      const taskProgress = process[taskProperty].details.progress as Record<
        string,
        number
      >;
      taskProgress[progressType] =
        (taskProgress[progressType] ?? 0) + incrementBy;
      progress[progressType] = taskProgress[progressType];
    }

    return { ...progress };
  }

  protected abstract getProgressMappings(): Partial<
    Record<TaskProgressType, keyof MiningTask['process']>
  >;

  protected async hasCompleted(miningId: string): Promise<boolean | undefined> {
    const task = this.ACTIVE_MINING_TASKS.get(miningId);
    if (!task) return undefined;

    const processList = this.getProcessList();

    await this.checkProcessCompletion(miningId, task, processList);

    const allStopped = processList.every(
      (key) => task.process[key]?.stoppedAt !== undefined
    );

    if (allStopped) {
      try {
        await this.deleteTask(miningId, null);
      } catch (error) {
        logger.error(`Error deleting task: ${(error as Error).message}`, {
          error
        });
      }
    }

    return allStopped;
  }

  // eslint-disable-next-line class-methods-use-this
  protected async checkProcessCompletion(
    _miningId: string,
    task: MiningTask,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _processList: (keyof MiningTask['process'])[]
  ): Promise<void> {
    const { process } = task;
    const progress: TaskProgress = {
      totalMessages: 0,
      fetched: 0,
      extracted: 0,
      verifiedContacts: 0,
      createdContacts: 0,
      signatures: 0
    };

    this.getProcessList().forEach((key) => {
      const p = process[key];
      if (p?.details?.progress) {
        Object.assign(progress, p.details.progress);
      }
    });

    if (
      process.fetch &&
      !process.fetch.stoppedAt &&
      process.fetch.status === TaskStatus.Done
    ) {
      await this.stopTask([process.fetch]);
      this.notifyChanges(task.miningId, 'fetched', 'fetching-finished');
    }

    if (
      process.signature &&
      process.fetch?.stoppedAt &&
      !process.signature.stoppedAt &&
      (process.signature.status === TaskStatus.Done ||
        !process.signature.details.enabled)
    ) {
      await this.stopTask([process.signature]);
    }

    if (
      process.extract &&
      !process.extract.stoppedAt &&
      process.fetch?.stoppedAt &&
      progress.extracted >= progress.fetched
    ) {
      await this.stopTask([process.extract]);
      this.notifyChanges(task.miningId, 'extracted', 'extracting-finished');
    }

    if (
      process.clean &&
      !process.clean.stoppedAt &&
      process.extract?.stoppedAt &&
      progress.verifiedContacts >= progress.createdContacts
    ) {
      await this.stopTask([process.clean]);
      this.notifyChanges(
        task.miningId,
        'verifiedContacts',
        'cleaning-finished'
      );
    }
  }

  private async pubsubStreamDestroy(streamName: string, consumerGroup: string) {
    await this.redisPublisher.xgroup('DESTROY', streamName, consumerGroup);
    await this.redisPublisher.del(streamName);
  }

  private async pubsubStreamCreate(streamName: string, consumerGroup: string) {
    await this.redisPublisher.xgroup(
      'CREATE',
      streamName,
      consumerGroup,
      '$',
      'MKSTREAM'
    );
  }

  private pubsubCommands(command: RedisCommand) {
    const commands = new Map<
      RedisCommand,
      (streamName: string, consumerGroupName: string) => Promise<void>
    >([
      [
        'REGISTER',
        async (streamName, consumerGroupName) => {
          await this.pubsubStreamCreate(streamName, consumerGroupName);
        }
      ],
      [
        'DELETE',
        async (streamName, consumerGroupName) => {
          await this.pubsubStreamDestroy(streamName, consumerGroupName);
        }
      ]
    ]);
    return commands.get(command);
  }

  protected async pubsubSendMessage(
    miningId: string,
    command: RedisCommand,
    stream: Partial<StreamInfo>
  ) {
    const [streamName, consumerGroup] = Object.values(stream);

    if (!consumerGroup || !streamName) return;

    const pubsubCommand = this.pubsubCommands(command);

    if (!pubsubCommand) {
      throw new Error(`COMMAND: ${command} not found`);
    }

    await pubsubCommand(streamName, consumerGroup);
    const message = { miningId, command, ...stream };
    await this.redisPublisher.publish(
      ENV.REDIS_PUBSUB_COMMUNICATION_CHANNEL,
      JSON.stringify(message)
    );
  }
}
