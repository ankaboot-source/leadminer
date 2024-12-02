// eslint-disable-next-line max-classes-per-file
import { Request, Response } from 'express';
import { Redis } from 'ioredis';
import SupabaseTasks from '../../db/supabase/tasks';
import logger from '../../utils/logger';
import EmailFetcherFactory from '../factory/EmailFetcherFactory';
import SSEBroadcasterFactory from '../factory/SSEBroadcasterFactory';
import { ImapEmailsFetcherOptions } from '../imap/types';
import {
  MiningTask,
  RedactedTask,
  RedisCommand,
  StreamInfo,
  Task,
  TaskCategory,
  TaskExtract,
  TaskFetch,
  TaskProgress,
  TaskProgressType,
  TaskStatus,
  TaskType
} from './types';
import { redactSensitiveData } from './utils';
import ENV from '../../config';

export default class TasksManager {
  /**
   * The Map of active mining tasks, with mining ID as the key and mining task object as the value.
   */
  private readonly ACTIVE_MINING_TASKS = new Map<string, MiningTask>();

  private static instance: TasksManager | null;

  /**
   * Creates a new MiningTaskManager instance.
   * @param redisSubscriber - The Redis subscriber instance to use for subscribing to mining events.
   * @param redisPublisher - The Redis publisher instance to use for publishing mining events.
   * @param emailFetcherFactory - The factory to use for creating email fetcher instances.
   * @param sseBroadcasterFactory - The factory to use for creating SSE broadcaster instances.
   * @param idGenerator - A function that generates unique mining IDs
   */
  constructor(
    private readonly tasksResolver: SupabaseTasks,
    private readonly redisSubscriber: Redis,
    private readonly redisPublisher: Redis,
    private readonly emailFetcherFactory: EmailFetcherFactory,
    private readonly sseBroadcasterFactory: SSEBroadcasterFactory,
    private readonly idGenerator: () => Promise<string>
  ) {
    if (TasksManager.instance) {
      throw new Error(
        'TasksManager class cannot be instantiated more than once.'
      );
    }

    TasksManager.instance = this;

    // Set up the Redis subscriber to listen for updates
    this.redisSubscriber.on('message', async (_channel, data) => {
      const { miningId, progressType, count } = JSON.parse(data);

      if (count > 0) {
        this.updateProgress(miningId, progressType, count);
        this.notifyChanges(miningId, progressType);

        await this.hasCompleted(miningId);
      }
    });
  }

  static resetInstance() {
    TasksManager.instance = null;
  }

  /**
   * Generates a unique mining ID for a given user.
   * @returns A Promise that resolves to the unique mining ID.
   */
  private generateMiningId() {
    return this.idGenerator();
  }

  /**
   * Generates a unique mining ID and stream name for a mining task.
   * @returns A Promise that resolves to an object containing the unique mining ID and stream name.
   */
  private async generateTaskInformation() {
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

  /**
   * Creates a new mining task for a given user with the specified options.
   * @param fetcherOptions - An object containing the options for the email fetcher.
   * @returns The new mining task.
   * @throws {Error} If a task with the same mining ID already exists.
   * @throws {Error} If there is an error when creating the task.
   */
  async createTask({
    imapConnectionProvider,
    email,
    boxes,
    batchSize,
    fetchEmailBody,
    userId
  }: ImapEmailsFetcherOptions) {
    try {
      const { miningId, stream } = await this.generateTaskInformation();
      const {
        messagesStream,
        messagesConsumerGroup,
        emailsStream,
        emailsConsumerGroup
      } = stream;

      const fetcher = this.emailFetcherFactory.create({
        imapConnectionProvider,
        boxes,
        userId,
        email,
        miningId,
        streamName: messagesStream,
        batchSize,
        fetchEmailBody
      });
      const progressHandlerSSE = this.sseBroadcasterFactory.create();

      const miningTask: MiningTask = {
        userId,
        miningId,
        progressHandlerSSE,
        process: {
          fetch: {
            userId,
            category: TaskCategory.Mining,
            type: TaskType.Fetch,
            status: TaskStatus.Running,
            instance: fetcher,
            details: {
              miningId,
              stream: {
                messagesStream
              },
              progress: {
                totalMessages: await fetcher.getTotalMessages(),
                folders: fetcher.folders,
                fetched: 0
              }
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
              progress: {
                extracted: 0
              }
            }
          },
          clean: {
            userId,
            category: TaskCategory.Cleaning,
            type: TaskType.Clean,
            status: TaskStatus.Running,
            details: {
              miningId,
              stream: {
                emailsStream,
                emailsConsumerGroup
              },
              progress: {
                verifiedContacts: 0,
                createdContacts: 0
              }
            }
          }
        },
        progress: {
          totalMessages: 0,
          fetched: 0,
          extracted: 0,
          verifiedContacts: 0,
          createdContacts: 0
        },
        startedAt: performance.now()
      };

      const { progress, process } = miningTask;
      const { fetch, extract, clean } = process;

      progress.totalMessages = fetch.details.progress.totalMessages;

      (await this.tasksResolver.create([fetch, extract, clean]))?.forEach(
        (task) => {
          const { id: TaskId, started_at: startedAt } = task;
          miningTask.process[`${task.type}`].id = TaskId;
          miningTask.process[`${task.type}`].startedAt = startedAt;
        }
      );

      this.ACTIVE_MINING_TASKS.set(miningId, miningTask);
      fetch.instance.start();

      await Promise.all(
        [extract, clean].map((p) =>
          this.pubsubSendMessage(miningId, 'REGISTER', p.details.stream)
        )
      );

      this.redisSubscriber.subscribe(miningId, (err) => {
        if (err) {
          logger.error('Failed subscribing to Redis.', err);
        }
      });

      return redactSensitiveData(miningTask);
    } catch (error) {
      logger.error('Error when creating task', error);
      throw error;
    }
  }

  /**
   * Retrieves the task with the specified mining ID.
   * @param miningId - The mining ID of the task to retrieve.
   * @returns Returns the task, otherwise throws error.
   */
  private getTaskOrThrow(miningId: string) {
    const task = this.ACTIVE_MINING_TASKS.get(miningId);
    if (!task) {
      throw new Error(`Task with mining ID ${miningId} does not exist.`);
    }
    return task;
  }

  /**
   * Retrieves the task with the specified mining ID.
   * @param miningId - The mining ID of the task to retrieve.
   * @returns Returns the task object if it exists, otherwise null.
   */
  getActiveTask(miningId: string) {
    const task = this.getTaskOrThrow(miningId);
    return redactSensitiveData(task);
  }

  /**
   * Attaches an SSE instance to a mining task.
   * @param miningId - The ID of the mining task to attach the SSE instance to.
   * @param connection - The connection object to attach the SSE instance to.
   * @throws {Error} If a task with the given mining ID doesn't exist.
   */
  attachSSE(miningId: string, connection: { req: Request; res: Response }) {
    const task = this.getTaskOrThrow(miningId);
    task.progressHandlerSSE.subscribeSSE(connection);
  }

  /**
   * Logs the task completion time and task progress.
   */
  private static logTaskCompletion(
    startedAt: number,
    progress: TaskProgress
  ): void {
    const duration = ((performance.now() - startedAt) / 1000).toFixed(2);
    logger.info(`Mining task completed in ${duration} seconds`, progress);
  }

  /**
   * Deletes a mining task or specific processes within a task.
   *
   * @param miningId - The unique identifier of the mining task to delete.
   * @param processIds - Optional array of process IDs to delete. If not provided, the entire task will be deleted.
   * @returns A redacted version of the deleted task, with sensitive information removed.
   * @throws {Error} If the task doesn't exist or if processIds is not an array of strings.
   */
  async deleteTask(
    miningId: string,
    processIds: string[] | null
  ): Promise<RedactedTask> {
    if (processIds && !Array.isArray(processIds)) {
      throw new Error('processIds must be an array of strings');
    }
    const task = this.getTaskOrThrow(miningId);
    const { progressHandlerSSE, startedAt, progress, process } = task;
    try {
      const endEntireTask = !processIds || processIds.length === 0;
      const processesToStop = Object.values(process).filter((p) =>
        endEntireTask
          ? !p.stoppedAt
          : !p.stoppedAt && p.id && processIds?.includes(p.id)
      );

      if (endEntireTask) {
        this.ACTIVE_MINING_TASKS.delete(miningId);
        progressHandlerSSE.stop();
      }

      await this.stopTask(processesToStop, true);
    } catch (error) {
      logger.error('Error when deleting task', error);
    }

    TasksManager.logTaskCompletion(startedAt, progress);
    return redactSensitiveData(task);
  }

  private static calculateTaskDuration(
    startedAt: string,
    stoppedAt: string
  ): number {
    const start = new Date(startedAt).getTime();
    const stop = new Date(stoppedAt).getTime();
    return stop - start;
  }

  /**
   * Stops one or more mining tasks and updates their status and timestamps.
   *
   * @param tasks - An array of mining tasks to stop.
   * @param canceled - Indicates whether the tasks were canceled (default is false).
   * @returns A Promise that resolves when all tasks have been stopped and updated.
   */
  private async stopTask(tasks: Task[], canceled = false): Promise<void> {
    const stopPromises = tasks.map(async (task) => {
      // eslint-disable-next-line no-param-reassign
      task.stoppedAt = new Date().toUTCString();

      if (task.duration === undefined && task.startedAt) {
        // eslint-disable-next-line no-param-reassign
        task.duration = TasksManager.calculateTaskDuration(
          task.startedAt,
          task.stoppedAt
        );
      }
      // eslint-disable-next-line no-param-reassign
      task.status = canceled ? TaskStatus.Canceled : TaskStatus.Done;

      if (task.type === 'fetch') {
        await (task as TaskFetch).instance.stop();
      }

      await this.pubsubSendMessage(
        task.details.miningId,
        'DELETE',
        task.details.stream
      );
      await this.tasksResolver.update(task);
    });

    await Promise.all(stopPromises);
  }

  private static getEventName(
    miningId: string,
    progressType: TaskProgressType,
    progress: TaskProgress,
    fetch: TaskFetch,
    extract: TaskExtract
  ) {
    let eventName = `${progressType}-${miningId}`;

    // If the fetching is completed, notify the clients that it has finished.
    if (progressType === 'fetched' && fetch.stoppedAt) {
      eventName = 'fetching-finished';
    }

    if (
      progressType === 'extracted' &&
      fetch.stoppedAt &&
      (progress.extracted >= progress.fetched || extract.stoppedAt)
    ) {
      eventName = 'extraction-finished';
    }
    return eventName;
  }

  /**
   * Notifies the client of the progress of a mining task with a given mining ID.
   *
   * @param miningId - The ID of the mining task to notify progress for.
   * @param progressType - The type of progress to notify.
   * @returns
   */
  private notifyChanges(
    miningId: string,
    progressType: TaskProgressType
  ): void {
    const task = this.ACTIVE_MINING_TASKS.get(miningId);

    if (!task?.progressHandlerSSE) return; // No progress handler to send updates from.

    const { progressHandlerSSE, process } = task;
    const { fetch, extract, clean } = process;

    const progress: TaskProgress = {
      ...fetch.details.progress,
      ...extract.details.progress,
      ...clean.details.progress
    };

    const value = progress[`${progressType}`];
    const eventName = TasksManager.getEventName(
      miningId,
      progressType,
      progress,
      fetch,
      extract
    );

    // Send the progress to parties subscribed on SSE
    progressHandlerSSE.sendSSE(value, eventName);
  }

  /**
   * Updates the progress of a mining task with a given mining ID.
   *
   * @param miningId - The ID of the mining task to update the progress for.
   * @param progressType - The type of progress to update.
   * @param incrementBy - The amount to increment progress by (default is 1).
   * @returns The updated progress or `undefined` if there is no task.
   * @throws {Error} Throws an error if the task is not found.
   */
  private updateProgress(
    miningId: string,
    progressType: TaskProgressType,
    incrementBy = 1
  ): TaskProgress | undefined {
    const task = this.ACTIVE_MINING_TASKS.get(miningId);
    if (!task) return undefined;

    const { progress, process } = task;
    const progressMappings: Partial<
      Record<TaskProgressType, keyof typeof process>
    > = {
      fetched: 'fetch',
      extracted: 'extract',
      createdContacts: 'clean',
      verifiedContacts: 'clean'
    };

    const taskProperty = progressMappings[progressType];

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

  /**
   * Check if a mining task has completed and, if so, deletes it.
   *
   * @param miningId - The ID of the mining task to check.
   * @returns `boolean` indicates if the task has completed and was deleted. `undefined` if task does not exist.
   */
  private async hasCompleted(miningId: string): Promise<boolean | undefined> {
    const task = this.ACTIVE_MINING_TASKS.get(miningId);
    if (!task) return undefined;

    const { fetch, extract, clean } = task.process;
    const progress: TaskProgress = {
      ...fetch.details.progress,
      ...extract.details.progress,
      ...clean.details.progress
    };

    logger.debug('Task progress update', {
      ...progress
    });

    if (!fetch.stoppedAt && fetch.instance.isCompleted) {
      await this.stopTask([fetch]);
    }

    if (
      !extract.stoppedAt &&
      fetch.stoppedAt &&
      progress.extracted >= progress.fetched
    ) {
      await this.stopTask([extract]);
    }

    const status =
      fetch.stoppedAt !== undefined &&
      extract.stoppedAt !== undefined &&
      progress.verifiedContacts >= progress.createdContacts;

    if (status) {
      await this.stopTask([clean]);
      try {
        await this.deleteTask(miningId, null);
      } catch (error) {
        logger.error(error);
      }
    }

    return status;
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

  /**
   * Sends a message to the Pub/Sub system for managing streams.
   *
   * @param miningId - The ID of the mining operation.
   * @param command - The command to execute. Valid options are 'REGISTER' or 'DELETE'.
   * @param stream - An object containing stream information.
   * @throws {Error} Throws an error if an invalid command is provided.
   */
  private async pubsubSendMessage(
    miningId: string,
    command: RedisCommand,
    stream: Partial<StreamInfo>
  ) {
    // The order of values is determined by the createTask() method
    const [streamName, consumerGroup] = Object.values(stream);

    if (!consumerGroup || !streamName) return;

    const pubsubCommand = this.pubsubCommands(command);

    if (!pubsubCommand) {
      throw new Error(`COMMAND: ${command} not found`);
    }

    await pubsubCommand(streamName, consumerGroup);
    const message = {
      miningId,
      command,
      ...stream
    };
    await this.redisPublisher.publish(
      ENV.REDIS_PUBSUB_COMMUNICATION_CHANNEL,
      JSON.stringify(message)
    );
  }
}
