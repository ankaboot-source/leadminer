import { Request, Response } from 'express';
import { Redis } from 'ioredis';
import {
  MiningSource,
  RedisCommand,
  StreamInfo,
  Task,
  TaskClean,
  TaskExtract
} from './types';
import { TaskCategory, TaskStatus, TaskType } from '../../db/types';

import ENV from '../../config';
import SupabaseTasks from '../../db/supabase/tasks';
import RealtimeSSE from '../../utils/helpers/sseHelpers';
import logger from '../../utils/logger';
import SSEBroadcasterFactory from '../factory/SSEBroadcasterFactory';

interface TaskProcessProgress {
  verifiedContacts: number;
  createdContacts: number;
  extracted: number;
  totalImported: number;
}

interface TaskProgress {
  totalImported: number;
  extracted: number;
  verifiedContacts: number;
  createdContacts: number;
}

interface MiningTask {
  userId: string;
  miningId: string;
  miningSource: MiningSource;
  process: {
    extract: TaskExtract;
    clean: TaskClean;
  };
  progress: TaskProgress;
  progressHandlerSSE: RealtimeSSE;
  startedAt: number;
}

/**
 * Represents a task with sensitive data removed.
 */
interface RedactedTask {
  userId: string;
  miningId: string;
  miningSource: MiningSource;
  processes: {
    [K in TaskType]?: string;
  };
  progress: {
    totalImported: number;
    extracted: number;
    verifiedContacts: number;
    createdContacts: number;
  };
}

function redactSensitiveData(task: MiningTask): RedactedTask {
  const processes = Object.fromEntries(
    Object.entries(task.process).map(([name, p]) => [name, p.id])
  );
  return {
    userId: task.userId,
    miningId: task.miningId,
    miningSource: task.miningSource,
    processes,
    progress: {
      ...task.progress
    }
  };
}

export default class TasksManagerPostgreSQL {
  /**
   * The Map of active mining tasks, with mining ID as the key and mining task object as the value.
   */
  private readonly ACTIVE_MINING_TASKS = new Map<string, MiningTask>();

  /**
   * Creates a new TasksManagerPostgreSQL instance.
   * @param tasksResolver - The SupabaseTasks instance to use for persisting tasks.
   * @param redisSubscriber - The Redis subscriber instance to use for subscribing to mining events.
   * @param redisPublisher - The Redis publisher instance to use for publishing mining events.
   * @param sseBroadcasterFactory - The factory to use for creating SSE broadcaster instances.
   */
  constructor(
    private readonly tasksResolver: SupabaseTasks,
    private readonly redisSubscriber: Redis,
    private readonly redisPublisher: Redis,
    private readonly sseBroadcasterFactory: SSEBroadcasterFactory
  ) {
    // Set up the Redis subscriber to listen for updates
    this.redisSubscriber.on('message', async (_channel, data) => {
      let message: {
        miningId?: string;
        progressType?: keyof TaskProcessProgress;
        count?: number;
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

      const { miningId, progressType, count } = message;

      if (!miningId || !progressType || typeof count !== 'number') {
        logger.warn('Ignoring incomplete Redis progress payload.', { data });
        return;
      }

      if (progressType === 'totalImported') {
        this.updateTotalImported(miningId, count);
        await this.hasCompleted(miningId);
      } else if (count > 0) {
        this.updateProgress(miningId, progressType, count);
        this.notifyChanges(miningId, progressType);

        await this.hasCompleted(miningId);
      }
    });
  }

  /**
   * Generates a unique mining ID for a given user.
   * @returns A Promise that resolves to the unique mining ID.
   */
  private static async generateMiningId() {
    return crypto.randomUUID();
  }

  /**
   * Generates a unique mining ID and stream name for a mining task.
   * @returns A Promise that resolves to an object containing the unique mining ID and stream name.
   */
  private static async generateTaskInformation() {
    const miningId = await TasksManagerPostgreSQL.generateMiningId();

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
   * @param userId - The ID of the user creating the task.
   * @param sourceName - The name of the PostgreSQL source.
   * @param totalRows - The total number of rows to import from PostgreSQL.
   * @returns The new mining task.
   * @throws {Error} If a task with the same mining ID already exists.
   * @throws {Error} If there is an error when creating the task.
   */
  async createTask(userId: string, sourceName: string, totalRows: number) {
    try {
      const { miningId, stream } =
        await TasksManagerPostgreSQL.generateTaskInformation();
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
        miningSource: {
          source: sourceName,
          type: 'postgresql'
        },
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
          totalImported: totalRows,
          extracted: 0,
          verifiedContacts: 0,
          createdContacts: 0
        },
        startedAt: performance.now()
      };

      const { process } = miningTask;
      const { extract, clean } = process;

      const taskExtract = await this.tasksResolver.create(extract);
      const taskClean = await this.tasksResolver.create(clean);

      miningTask.process.extract.id = taskExtract.id;
      miningTask.process.clean.id = taskClean.id;
      miningTask.process.extract.startedAt = taskExtract.startedAt;
      miningTask.process.clean.startedAt = taskClean.startedAt;

      this.ACTIVE_MINING_TASKS.set(miningId, miningTask);

      await Promise.all(
        [extract, clean].map((p) =>
          this.pubsubSendMessage(miningId, 'REGISTER', p.details.stream)
        )
      );

      logger.info('Stream registration commands sent', {
        miningId,
        extract: {
          messagesStream: extract.details.stream.messagesStream,
          emailsVerificationStream:
            extract.details.stream.emailsVerificationStream
        },
        clean: {
          emailsStream: clean.details.stream.emailsStream
        }
      });

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
  getTaskOrThrow(miningId: string) {
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
    const { startedAt, progress } = task;
    try {
      await this.handleTaskDeletion(miningId, processIds ?? [], task);
    } catch (error) {
      logger.error('Error when deleting task', error);
    }

    TasksManagerPostgreSQL.logTaskCompletion(startedAt, progress);
    return redactSensitiveData(task);
  }

  private async handleTaskDeletion(
    miningId: string,
    processIds: string[],
    task: MiningTask
  ) {
    const { progressHandlerSSE, process } = task;

    const endEntireTask = !processIds || processIds.length === 0;
    const processesToStop = Object.values(process).filter((p) =>
      endEntireTask
        ? !p.stoppedAt
        : !p.stoppedAt && p.id && processIds?.includes(p.id)
    );

    if (processesToStop.length) {
      await this.stopTask(processesToStop, true);
    }

    const isCompleted = await TasksManagerPostgreSQL.getCompletionStatus(
      process.extract,
      process.clean
    );

    if (isCompleted) {
      this.ACTIVE_MINING_TASKS.delete(miningId);
      progressHandlerSSE.sendSSE('mining-completed', 'mining-completed');
      progressHandlerSSE.stop();
    }
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
        task.duration = TasksManagerPostgreSQL.calculateTaskDuration(
          task.startedAt,
          task.stoppedAt
        );
      }
      // eslint-disable-next-line no-param-reassign
      task.status = canceled ? TaskStatus.Canceled : TaskStatus.Done;

      await this.pubsubSendMessage(
        task.details.miningId,
        'DELETE',
        task.details.stream
      );
      await this.tasksResolver.update(task);
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
    progressType: keyof TaskProcessProgress,
    event: string | null = null
  ): void {
    const task = this.ACTIVE_MINING_TASKS.get(miningId);

    if (!task?.progressHandlerSSE) return; // No progress handler to send updates from.
    const { progressHandlerSSE } = task;

    const progress = TasksManagerPostgreSQL.getTaskProcessProgress(task);

    const value = progress[`${progressType}`];
    const eventName = event ?? `${progressType}-${miningId}`;
    // Send the progress to parties subscribed on SSE
    progressHandlerSSE.sendSSE(value, eventName);
  }

  /**
   * Updates the totalImported count for a mining task.
   *
   * @param miningId - The ID of the mining task to update.
   * @param count - The new totalImported count.
   */
  private updateTotalImported(miningId: string, count: number): void {
    const task = this.ACTIVE_MINING_TASKS.get(miningId);
    if (!task) return;

    task.progress.totalImported = count;

    logger.debug('Updating totalImported', {
      miningId,
      totalImported: count
    });

    // Notify frontend about the updated total
    this.notifyChanges(miningId, 'totalImported');
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
    progressType: keyof TaskProcessProgress,
    incrementBy = 1
  ): TaskProgress | undefined {
    const task = this.ACTIVE_MINING_TASKS.get(miningId);
    if (!task) return undefined;

    const { progress, process } = task;
    const progressMappings: Partial<
      Record<keyof TaskProcessProgress, keyof typeof process>
    > = {
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

    const { extract, clean } = task.process;
    const progress = TasksManagerPostgreSQL.getTaskProcessProgress(task);

    logger.debug('Task progress update', {
      ...progress
    });

    await this.handleExtractionFinished(
      miningId,
      progress,
      extract,
      task.progress.totalImported
    );

    await this.handleCleaningFinished(miningId, progress, extract, clean);

    const status = await TasksManagerPostgreSQL.getCompletionStatus(
      extract,
      clean
    );

    if (status) {
      try {
        await this.deleteTask(miningId, null);
      } catch (error) {
        logger.error(error);
      }
    }

    return status;
  }

  private async handleExtractionFinished(
    miningId: string,
    progress: TaskProcessProgress,
    extract: TaskExtract,
    totalImported: number
  ) {
    if (!extract.stoppedAt && progress.extracted >= totalImported) {
      logger.debug('[Progress update]: stopping extracting task', {
        status: extract.status,
        started_at: extract.startedAt,
        stopped_at: extract.stoppedAt,
        progress
      });
      await this.stopTask([extract]);
      this.notifyChanges(miningId, 'extracted', 'extracting-finished');
    }
  }

  private async handleCleaningFinished(
    miningId: string,
    progress: TaskProcessProgress,
    extract: TaskExtract,
    clean: TaskClean
  ) {
    if (
      !clean.stoppedAt &&
      extract.stoppedAt &&
      progress.verifiedContacts >= progress.createdContacts
    ) {
      logger.debug('[Progress update]: stopping cleaning task', {
        status: clean.status,
        started_at: clean.startedAt,
        stopped_at: clean.stoppedAt,
        progress
      });
      await this.stopTask([clean]);
      this.notifyChanges(miningId, 'verifiedContacts', 'cleaning-finished');
    }
  }

  private static async getCompletionStatus(
    extract: TaskExtract,
    clean: TaskClean
  ) {
    const status =
      extract.stoppedAt !== undefined && clean.stoppedAt !== undefined;
    return status;
  }

  private static getTaskProcessProgress(task: MiningTask): TaskProcessProgress {
    const { extract, clean } = task.process;
    const progress = {
      ...extract.details.progress,
      ...clean.details.progress,
      totalImported: task.progress.totalImported
    };
    return progress;
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
