// eslint-disable-next-line max-classes-per-file
import { Request, Response } from 'express';
import { Redis } from 'ioredis';
import {
  REDIS_PUBSUB_COMMUNICATION_CHANNEL,
  REDIS_STREAMS_CONSUMER_GROUP
} from '../../utils/constants';
import logger from '../../utils/logger';
import EmailFetcherFactory from '../factory/EmailFetcherFactory';
import SSEBroadcasterFactory from '../factory/SSEBroadcasterFactory';
import { ImapEmailsFetcherOptions } from '../imap/types';
import {
  FetcherStatus,
  ProgressType,
  RedisCommand,
  Task,
  TaskProgress
} from './types';
import { redactSensitiveData } from './utils';

export default class TasksManager {
  private readonly REDIS_PUBSUB_COMMUNICATION_CHANNEL =
    REDIS_PUBSUB_COMMUNICATION_CHANNEL;

  private readonly REDIS_STREAMS_CONSUMER_GROUP_NAME =
    REDIS_STREAMS_CONSUMER_GROUP;

  /**
   * The Map of active mining tasks, with mining ID as the key and mining task object as the value.
   */
  private readonly ACTIVE_MINING_TASKS = new Map<string, Task>();

  private static instance: TasksManager;

  /**
   * Creates a new MiningTaskManager instance.
   * @param redisSubscriber - The Redis subscriber instance to use for subscribing to mining events.
   * @param redisPublisher - The Redis publisher instance to use for publishing mining events.
   * @param emailFetcherFactory - The factory to use for creating email fetcher instances.
   * @param sseBroadcasterFactory - The factory to use for creating SSE broadcaster instances.
   * @param idGenerator - A function that generates unique mining IDs
   */
  constructor(
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

      const progress = this.updateProgress(miningId, progressType, count || 1);
      const notified = this.notifyChanges(miningId, progressType);

      if (progress !== null && notified !== null) {
        await this.hasCompleted(miningId, progress);
      }
    });
  }

  /**
   * Generates a unique mining ID for a given user.
   * @returns A Promise that resolves to the unique mining ID.
   */
  generateMiningId() {
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
        streamName: `stream-${miningId}`,
        consumerGroupName: this.REDIS_STREAMS_CONSUMER_GROUP_NAME
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
      const { streamName } = stream;

      const fetcher = this.emailFetcherFactory.create({
        imapConnectionProvider,
        boxes,
        userId,
        email,
        miningId,
        streamName,
        batchSize,
        fetchEmailBody
      });
      const progressHandlerSSE = this.sseBroadcasterFactory.create();

      const miningTask: Task = {
        stream,
        userId,
        fetcher,
        miningId,
        startedAt: performance.now(),
        progressHandlerSSE,
        progress: {
          totalMessages: await fetcher.getTotalMessages(),
          fetched: 0,
          extracted: 0
        }
      };

      fetcher.start();
      await this.pubsubSendMessage(
        miningId,
        'REGISTER',
        stream.streamName,
        stream.consumerGroupName
      );

      this.ACTIVE_MINING_TASKS.set(miningId, miningTask);
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
   * @returns Returns the task object if it exists, otherwise null.
   */
  getActiveTask(miningId: string) {
    const task = this.ACTIVE_MINING_TASKS.get(miningId);

    if (task === undefined) {
      throw new Error(`Task with mining ID ${miningId} doesn't exist.`);
    }

    return redactSensitiveData(task);
  }

  /**
   * Attaches an SSE instance to a mining task.
   * @param miningId - The ID of the mining task to attach the SSE instance to.
   * @param connection - The connection object to attach the SSE instance to.
   * @throws {Error} If a task with the given mining ID doesn't exist.
   */
  attachSSE(miningId: string, connection: { req: Request; res: Response }) {
    const task = this.ACTIVE_MINING_TASKS.get(miningId);

    if (task === undefined) {
      throw new Error(`Task with mining ID ${miningId} doesn't exist.`);
    }

    task.progressHandlerSSE.subscribeSSE(connection);
  }

  /**
   * Deletes a mining task with a given mining ID.
   * @param miningId - The mining ID of the task to delete.
   * @returns Returns the deleted task.
   * @throws {Error} Throws an error if the task with the given mining ID does not exist.
   */
  async deleteTask(miningId: string) {
    const task = this.ACTIVE_MINING_TASKS.get(miningId);

    if (task === undefined) {
      throw new Error(`Task with mining ID ${miningId} doesn't exist.`);
    }

    const { fetcher, progressHandlerSSE, stream, startedAt, progress } = task;

    this.ACTIVE_MINING_TASKS.delete(miningId);

    try {
      await fetcher.stop();
      progressHandlerSSE.stop();
      await this.pubsubSendMessage(
        miningId,
        'DELETE',
        stream.streamName,
        stream.consumerGroupName
      );
    } catch (error) {
      logger.error('Error when deleting task', error);
    }

    logger.info(
      `Mining task took ${((performance.now() - startedAt) / 1000).toFixed(
        2
      )} seconds`,
      progress
    );
    return redactSensitiveData(task);
  }

  /**
   * Notifies the client of the progress of a mining task with a given mining ID.
   * @param miningId - The ID of the mining task to notify progress for.
   * @param progressType - The type of progress to notify ('fetched' or 'extracted').
   * @returns Returns null if the mining task does not exist.
   */
  notifyChanges(miningId: string, progressType: ProgressType) {
    const task = this.ACTIVE_MINING_TASKS.get(miningId);

    // If the mining task does not exist or has no progress handler, return null
    if (!task?.progressHandlerSSE) {
      return null;
    }

    const { fetcher, progressHandlerSSE, progress } = task;

    const eventName = `${progressType}-${miningId}`;
    const value = progress[`${progressType}`];

    // If the fetching is completed, notify the clients that it has finished.
    if (progressType === 'fetched' && fetcher.isCompleted) {
      progressHandlerSSE.sendSSE(value, 'fetching-finished');
    }

    // Send the progress to parties subscribed on SSE
    return progressHandlerSSE.sendSSE(value, eventName);
  }

  /**
   * Updates the progress of a mining task with a given mining ID.
   * @param miningId - The ID of the mining task to update the progress for.
   * @param progressType - The type of progress to update ('fetched' or 'extracted').
   * @param incrementBy - The amount to increment progress by (default is 1).
   * @returns An object containing the updated mining progress, or null if task is not found.
   * The returned object has the following properties:
   * - extracted (number): The updated number of messages already extracted.
   * - fetched (number): The updated number of messages already fetched.
   * - fetchingStatus (boolean): Indicates whether the fetching process has been completed or not.
   * @throws {Error} Throws an error if the `progressType` parameter is not set to either 'fetched' or 'extracted'.
   */
  private updateProgress(
    miningId: string,
    progressType: ProgressType,
    incrementBy = 1
  ) {
    if (!['fetched', 'extracted'].includes(progressType)) {
      throw Error('progressType value must be either fetched or extracted.');
    }

    const task = this.ACTIVE_MINING_TASKS.get(miningId);

    if (task === undefined) {
      return null;
    }

    const { progress, fetcher } = task;

    progress[`${progressType}`] =
      (progress[`${progressType}`] || 0) + incrementBy;

    const fetcherStatus: FetcherStatus = fetcher.isCompleted
      ? 'completed'
      : 'running';

    return { ...progress, fetcherStatus };
  }

  /**
   * Checks whether a mining task has completed and deletes it if it has.
   * @async
   * @param miningId - The ID of the mining task to check.
   * @param progress - An object containing the extracted and fetched progress for the task.
   * @returns An object containing the status of the task and the task itself (if it has been deleted).
   */
  private async hasCompleted(
    miningId: string,
    { extracted, fetched, fetcherStatus }: TaskProgress
  ) {
    const status = fetcherStatus === 'completed' && extracted >= fetched;
    const task = status ? await this.deleteTask(miningId) : null;

    return { status, task };
  }

  /**
   * Sends a message to the Pub/Sub system for managing streams.
   *
   * @param miningId - The ID of the mining operation.
   * @param command - The command to execute. Valid options are 'register' or 'delete'.
   * @param streamName - The name of the stream.
   * @param consumerGroupName - The name of the consumer group.
   * @throws {Error} Throws an error if an invalid command is provided.
   */
  private async pubsubSendMessage(
    miningId: string,
    command: RedisCommand,
    streamName: string,
    consumerGroupName: string
  ) {
    if (!['REGISTER', 'DELETE'].includes(command)) {
      throw new Error(
        `Invalid command '${command}', expected 'REGISTER' or 'DELETE'.`
      );
    }

    switch (command) {
      case 'REGISTER': {
        // Create consumer group and empty stream.
        await this.redisPublisher.xgroup(
          'CREATE',
          streamName,
          consumerGroupName,
          '$',
          'MKSTREAM'
        );
        break;
      }
      case 'DELETE': {
        // Delete the stream and consumer groups.
        await this.redisPublisher.xgroup(
          'DESTROY',
          streamName,
          consumerGroupName
        );
        await this.redisPublisher.del(streamName);
        break;
      }
      default:
    }

    const message = { miningId, command, streamName, consumerGroupName };
    await this.redisPublisher.publish(
      this.REDIS_PUBSUB_COMMUNICATION_CHANNEL,
      JSON.stringify(message)
    );
  }
}
