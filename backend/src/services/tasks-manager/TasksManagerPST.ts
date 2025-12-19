import { Request, Response } from 'express';
import { Redis } from 'ioredis';
import {
  MiningTask,
  RedactedTask,
  RedisCommand,
  StreamInfo,
  Task,
  TaskProgress,
  TaskProgressType
} from './types';
// eslint-disable-next-line max-classes-per-file
import { TaskCategory, TaskStatus, TaskType } from '../../db/types';

import ENV from '../../config';
import { mailMiningComplete, refineContacts } from '../../db/mail';
import SupabaseTasks from '../../db/supabase/tasks';
import logger from '../../utils/logger';
import PSTFetcherClient from '../email-fetching/pst';
import SSEBroadcasterFactory from '../factory/SSEBroadcasterFactory';
import { redactSensitiveData } from './utils';

export default class TasksManagerPST {
  /**
   * The Map of active mining tasks, with mining ID as the key and mining task object as the value.
   */
  private readonly ACTIVE_MINING_TASKS = new Map<string, MiningTask>();

  private static instance: TasksManagerPST | null;

  /**
   * Creates a new MiningTaskManager instance.
   * @param redisSubscriber - The Redis subscriber instance to use for subscribing to mining events.
   * @param redisPublisher - The Redis publisher instance to use for publishing mining events.
   * @param sseBroadcasterFactory - The factory to use for creating SSE broadcaster instances.
   * @param idGenerator - A function that generates unique mining IDs
   */
  constructor(
    private readonly tasksResolver: SupabaseTasks,
    private readonly redisSubscriber: Redis,
    private readonly redisPublisher: Redis,
    private readonly PSTFetcherClient: PSTFetcherClient,
    private readonly sseBroadcasterFactory: SSEBroadcasterFactory,
    private readonly idGenerator: () => Promise<string>
  ) {
    if (TasksManagerPST.instance) {
      throw new Error(
        'TasksManagerPST class cannot be instantiated more than once.'
      );
    }

    TasksManagerPST.instance = this;

    // Set up the Redis subscriber to listen for updates
    this.redisSubscriber.on('message', async (_channel, data) => {
      const { miningId, progressType, count, isCompleted, isCanceled } =
        JSON.parse(data);

      if (progressType === 'signatures' && isCompleted) {
        const task = this.ACTIVE_MINING_TASKS.get(miningId);

        if (!task) return;

        const { signature } = task.process;

        signature.status = TaskStatus.Done;
      }

      if (progressType === 'fetched' && (isCanceled || isCompleted)) {
        const task = this.ACTIVE_MINING_TASKS.get(miningId);

        if (!task) return;

        const { fetch } = task.process;

        fetch.status = isCanceled ? TaskStatus.Canceled : TaskStatus.Done;

        if (
          !fetch.stoppedAt &&
          [TaskStatus.Done, TaskStatus.Canceled].includes(fetch.status)
        ) {
          await this.stopTask([fetch], isCanceled);
          this.notifyChanges(miningId, 'fetched', 'fetching-finished');
        }
      }

      if (count > 0) {
        this.updateProgress(miningId, progressType, count);
        this.notifyChanges(miningId, progressType);
      }
      await this.hasCompleted(miningId);
    });
  }

  static resetInstance() {
    TasksManagerPST.instance = null;
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
  async createTask(
    userId: string,
    source: string, //filename
    fetchEmailBody: boolean
  ) {
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

      const progressHandlerSSE = this.sseBroadcasterFactory.create();

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
              stream: {
                signatureStream: 'email-signature'
              },
              progress: {
                signatures: 0
              }
            }
          },
          fetch: {
            userId,
            category: TaskCategory.Mining,
            type: TaskType.Fetch,
            status: TaskStatus.Running,
            details: {
              miningId,
              stream: {
                messagesStream
              },
              progress: {
                totalMessages: 0,
                folders: [],
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
          createdContacts: 0,
          signatures: 0
        },
        startedAt: performance.now()
      };

      const { progress, process } = miningTask;
      const { fetch, extract, clean, signature } = process;

      const taskFetch = await this.tasksResolver.create(fetch);
      const taskSignature = await this.tasksResolver.create(signature);
      const taskExtract = await this.tasksResolver.create(extract);
      const taskClean = await this.tasksResolver.create(clean);

      miningTask.process.fetch.id = taskFetch.id;
      miningTask.process.signature.id = taskSignature.id;
      miningTask.process.extract.id = taskExtract.id;
      miningTask.process.clean.id = taskClean.id;

      miningTask.process.fetch.startedAt = taskFetch.startedAt;
      miningTask.process.signature.startedAt = taskSignature.startedAt;
      miningTask.process.extract.startedAt = taskExtract.startedAt;
      miningTask.process.clean.startedAt = taskClean.startedAt;

      this.ACTIVE_MINING_TASKS.set(miningId, miningTask);

      await Promise.all(
        [extract, clean].map((p) =>
          this.pubsubSendMessage(miningId, 'REGISTER', p.details.stream)
        )
      );

      try {
        const {
          data: { totalMessages }
        } = await this.PSTFetcherClient.startFetch({
          userId,
          miningId,
          source, // source is set here, w f taskmanager le5er esmha email raw
          extractSignatures: fetchEmailBody,
          contactStream: messagesStream,
          signatureStream: ENV.REDIS_SIGNATURE_STREAM_NAME
        });

        progress.totalMessages = totalMessages;
      } catch (error) {
        logger.error(`Failed to start fetching task with id: ${miningId}`, {
          error
        });
        throw new Error('Failed to start fetching');
      }

      this.redisSubscriber.subscribe(miningId, (err) => {
        if (err) {
          logger.error('Failed subscribing to Redis.', err);
        }
      });

      return redactSensitiveData(miningTask);
    } catch (error) {
      logger.error('Error when creating task', error);
      if (miningTaskId) {
        await this.deleteTask(miningTaskId, null);
      }
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
    const { fetch, extract, clean, signature } = process;

    try {
      const endEntireTask = !processIds || processIds.length === 0;
      const processesToStop = Object.values(process).filter((p) =>
        endEntireTask
          ? !p.stoppedAt
          : !p.stoppedAt && p.id && processIds?.includes(p.id)
      );

      if (processesToStop.length) {
        await this.stopTask(processesToStop, true);
      }

      const isCompleted = [fetch, extract, clean, signature].every(
        (p) => p.stoppedAt != null
      );

      if (isCompleted) {
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

    TasksManagerPST.logTaskCompletion(startedAt, progress);
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
        task.duration = TasksManagerPST.calculateTaskDuration(
          task.startedAt,
          task.stoppedAt
        );
      }
      // eslint-disable-next-line no-param-reassign
      task.status = canceled ? TaskStatus.Canceled : TaskStatus.Done;

      try {
        if (task.type === 'fetch') {
          await this.PSTFetcherClient.stopFetch({
            miningId: task.details.miningId,
            canceled: task.status === 'canceled'
          });
        }

        await this.pubsubSendMessage(
          task.details.miningId,
          'DELETE',
          task.details.stream
        );
        await this.tasksResolver.update(task);
      } catch (error) {
        logger.error(
          `Failed to stop current active task with id: ${task.details.miningId}`,
          { error }
        );
      }
    });

    await Promise.all(stopPromises);
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
    progressType: TaskProgressType,
    event: string | null = null
  ): void {
    const task = this.ACTIVE_MINING_TASKS.get(miningId);

    if (!task?.progressHandlerSSE) return; // No progress handler to send updates from.

    const { progressHandlerSSE, process } = task;
    const { fetch, extract, clean, signature } = process;

    const progress: TaskProgress = {
      ...fetch.details.progress,
      ...extract.details.progress,
      ...clean.details.progress,
      ...signature.details.progress
    };

    const value = progress[`${progressType}`];
    const eventName = event ?? `${progressType}-${miningId}`;
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
      verifiedContacts: 'clean',
      signatures: 'signature'
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

    const { fetch, extract, clean, signature } = task.process;
    const progress: TaskProgress = {
      ...fetch.details.progress,
      ...extract.details.progress,
      ...clean.details.progress,
      ...signature.details.progress
    };

    if (!fetch.stoppedAt && fetch.status === TaskStatus.Done) {
      logger.debug('Task progress update', {
        ...progress
      });
      await this.stopTask([fetch]);
      this.notifyChanges(task.miningId, 'fetched', 'fetching-finished');
    }

    if (
      fetch.stoppedAt &&
      !signature.stoppedAt &&
      (signature.status === TaskStatus.Done || !signature.details.enabled)
    ) {
      await this.stopTask([signature]);
    }

    if (
      !extract.stoppedAt &&
      fetch.stoppedAt &&
      progress.extracted >= progress.fetched
    ) {
      logger.debug('Task progress update', {
        ...progress
      });
      await this.stopTask([extract]);
      this.notifyChanges(task.miningId, 'extracted', 'extracting-finished');
    }

    if (
      !clean.stoppedAt &&
      extract.stoppedAt &&
      progress.verifiedContacts >= progress.createdContacts
    ) {
      logger.debug('Task progress update', {
        ...progress
      });
      await this.stopTask([clean]);
      this.notifyChanges(
        task.miningId,
        'verifiedContacts',
        'cleaning-finished'
      );
    }

    const status =
      fetch.stoppedAt !== undefined &&
      extract.stoppedAt !== undefined &&
      clean.stoppedAt !== undefined &&
      signature.stoppedAt !== undefined;

    if (status) {
      try {
        await this.deleteTask(miningId, null);
      } catch (error) {
        logger.error(`Error deleting task: ${(error as Error).message}`, {
          error
        });
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
