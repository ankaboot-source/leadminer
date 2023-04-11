const { flickrBase58IdGenerator } = require('../utils/helpers/hashHelpers');
const { RealtimeSSE } = require('../utils/helpers/sseHelpers');
const { logger } = require('../utils/logger');
const { redis } = require('../utils/redis');
const { db } = require('../db');
const { ImapEmailsFetcher } = require('./ImapEmailsFetcher');
const {
  REDIS_PUBSUB_COMMUNICATION_CHANNEL,
  REDIS_STREAMS_CONSUMER_GROUP
} = require('../utils/constants');

/**
 * Removes sensitive data from a task object.
 *
 * @param {object} task - The task object to redact sensitive data from.
 * @returns {object} - A new task object with sensitive data removed.
 */
function redactSensitiveData(task) {
  return {
    /**
     * The redacted task data.
     * @type {Object}
     * @property {string} userId - The ID of the user who the task belongs to.
     * @property {string} miningId - The ID of the mining task associated with this task.
     *
     * @property {object} progress - Information about The progress associated with this task.
     * @property {number} progress.totalMessages - The total number of messages that need to be fetched/processed.
     * @property {number} progress.fetched - Indicating the fetcher progress (total fetched messages).
     * @property {number} progress.extracted - Indicating the extractor progress (total extracted messages).
     *
     * @property {Object} fetcher - Information about the fetcher associated with this task.
     * @property {string} fetcher.status - The status of the fetcher, either "running" or "completed".
     * @property {string[]} fetcher.folders - An array of folder names to be fetched.
     */
    task: {
      userId: task.userId,
      miningId: task.miningId,
      progress: {
        totalMessages: task.progress.totalMessages,
        extracted: task.progress.extracted,
        fetched: task.progress.fetched
      },
      fetcher: {
        status: task.fetcher.isCompleted === true ? 'completed' : 'running',
        folders: task.fetcher.folders
      }
    }
  };
}

class TasksManager {
  /**
   * The Redis Pub/Sub communication channel and Redis Streams consumer group name for the task manager.
   * @type {string}
   */
  REDIS_PUBSUB_COMMUNICATION_CHANNEL = REDIS_PUBSUB_COMMUNICATION_CHANNEL;
  REDIS_STREAMS_CONSUMER_GROUP_NAME = REDIS_STREAMS_CONSUMER_GROUP;
  /**
   * The Map of active mining tasks, with mining ID as the key and mining task object as the value.
   * @type {Map<string, object>}
   */
  #ACTIVE_MINING_TASKS = new Map();

  /**
   * Creates a new MiningTaskManager instance.
   * @param {object} redisSubscriber - The Redis subscriber instance to use for subscribing to mining events.
   * @param {object} redisPublisher - The Redis publisher instance to use for publishing mining events.
   * @param {EmailFetcherFactory} emailFetcherFactory - The factory to use for creating email fetcher instances.
   * @param {SSEBroadcasterFactory} sseBroadcasterFactory - The factory to use for creating SSE broadcaster instances.
   */
  constructor(
    redisSubscriber,
    redisPublisher,
    emailFetcherFactory,
    sseBroadcasterFactory
  ) {
    this.redisSubscriber = redisSubscriber;
    this.redisPublisher = redisPublisher;

    this.emailFetcherFactory = emailFetcherFactory;
    this.sseBroadcasterFactory = sseBroadcasterFactory;

    // Set up the Redis subscriber to listen for updates
    this.redisSubscriber.on('message', async (_, data) => {
      const { miningId, progressType, count } = JSON.parse(data);

      const progress = this.#updateProgress(miningId, progressType, count || 1);
      const notified = this.#notifyChanges(miningId, progressType);

      const { status, task } =
        progress !== null && notified !== null
          ? await this.#hasCompleted(miningId, progress)
          : {};

      if (status === true) {
        const { userId } = task;
        db.callRpcFunction(userId, 'refined_persons');
      }
    });

    this.idGenerator = flickrBase58IdGenerator();
  }

  /**
   * Generates a unique mining ID for a given user.
   * @returns {Promise<string>} A Promise that resolves to the unique mining ID.
   */
  async generateMiningId() {
    const generator = await this.idGenerator;
    const id = await generator();
    return id;
  }

  /**
   * Generates a unique mining ID and stream name for a mining task.
   * @returns {Promise<object>} A Promise that resolves to an object containing the unique mining ID and stream name.
   */
  async generateTaskInformation() {
    const miningId = await this.generateMiningId();
    const streamName = `stream-${miningId}`;
    const consumerGroupName = this.REDIS_STREAMS_CONSUMER_GROUP_NAME;

    return {
      miningId,
      stream: {
        streamName,
        consumerGroupName
      },
      progress: {
        totalMessages: null,
        fetched: null,
        extracted: null
      },
      fetcher: null,
      progressHandlerSSE: null
    };
  }

  /**
   * Creates a new mining task for a given user with the specified options.
   * @param {string} userId - The ID of the user for whom the task is being created.
   * @param {object} fetcherOptions - An object containing the options for the email fetcher.
   * @param {string} fetcherOptions.email - The email address to connect to.
   * @param {string} fetcherOptions.userId - The ID of the user.
   * @param {number} fetcherOptions.batchSize - The number of emails to process before sending a notification.
   * @param {string[]} fetcherOptions.boxes - An array of strings specifying the email boxes to mine.
   * @param {object} fetcherOptions.imapConnectionProvider - A configured email connection provider object.
   * @returns {object} - The new mining task.
   *
   * @throws {Error} If a task with the same mining ID already exists.
   * @throws {Error} If there is an error when creating the task.
   */
  async createTask(userId, fetcherOptions) {
    const miningTask = { userId, ...(await this.generateTaskInformation()) };
    const { miningId, stream } = miningTask;
    const { streamName } = stream;
    const { imapConnectionProvider, email, boxes, batchSize } = fetcherOptions;

    try {
      const fetcher = this.emailFetcherFactory.create({
        imapConnectionProvider,
        boxes,
        userId,
        email,
        miningId,
        streamName,
        batchSize
      });
      const progressHandlerSSE = this.sseBroadcasterFactory.create();

      miningTask.fetcher = fetcher;
      miningTask.progressHandlerSSE = progressHandlerSSE;
      miningTask.progress.totalMessages = await fetcher.getTotalMessages();

      fetcher.start(); // start the fetching process
      await this.#pubsubSendMessage(miningId, 'REGISTER', { ...stream });
    } catch (error) {
      logger.error('Error when creating task', {
        metadata: { details: error.message }
      });
      throw new Error(`${error.message}`);
    }

    this.#ACTIVE_MINING_TASKS.set(miningId, miningTask);

    this.redisSubscriber.subscribe(miningId, (err) => {
      if (err) {
        logger.error('Failed subscribing to Redis.', { metadata: { err } });
      }
    });

    return redactSensitiveData(miningTask);
  }

  /**
   * Retrieves the task with the specified mining ID.
   * @param {string} miningId - The mining ID of the task to retrieve.
   * @returns {Object|null} Returns the task object if it exists, otherwise null.
   */
  getActiveTask(miningId) {
    const task = this.#ACTIVE_MINING_TASKS.get(miningId);

    if (task === undefined) {
      throw new Error(`Task with mining ID ${miningId} doesn't exist.`);
    }
    return redactSensitiveData(task);
  }

  /**
   * Attaches an SSE instance to a mining task.
   *
   * @param {string} miningId - The ID of the mining task to attach the SSE instance to.
   * @param {{req, res}} connection - The connection object to attach the SSE instance to.
   * @returns {void}
   * @throws {Error} If a task with the given mining ID doesn't exist.
   */
  attachSSE(miningId, connection) {
    const task = this.#ACTIVE_MINING_TASKS.get(miningId);

    if (task === undefined) {
      throw new Error(`Task with mining ID ${miningId} doesn't exist.`);
    }

    task.progressHandlerSSE.subscribeSSE(connection);
  }

  /**
   * Deletes a mining task with a given mining ID.
   * @param {string} miningId - The mining ID of the task to delete.
   * @returns {object} Returns the deleted task.
   * @throws {Error} Throws an error if the task with the given mining ID does not exist.
   */
  async deleteTask(miningId) {
    const task = this.#ACTIVE_MINING_TASKS.get(miningId);

    if (task === undefined) {
      throw new Error(`Task with mining ID ${miningId} doesn't exist.`);
    }

    const { fetcher, progressHandlerSSE, stream } = task;

    this.#ACTIVE_MINING_TASKS.delete(miningId);

    try {
      await fetcher.stop();
      await progressHandlerSSE.stop();
      await this.#pubsubSendMessage(miningId, 'DELETE', { ...stream });
    } catch (error) {
      logger.error('Error when deleting task', {
        metadata: { details: error.message }
      });
    }

    return redactSensitiveData(task);
  }

  /**
   * Notifies the client of the progress of a mining task with a given mining ID.
   * @param {string} miningId - The ID of the mining task to notify progress for.
   * @param {string} progressType - The type of progress to notify ('fetched' or 'extracted').
   * @returns Returns null if the mining task does not exist.
   */
  #notifyChanges(miningId, progressType) {
    const task = this.#ACTIVE_MINING_TASKS.get(miningId);

    // If the mining task does not exist or has no progress handler, return null
    if (!task || !task.progressHandlerSSE) {
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
   * @param {string} miningId - The ID of the mining task to update the progress for.
   * @param {string} progressType - The type of progress to update ('fetched' or 'extracted').
   * @param {number} incrementBy - The amount to increment progress by (default is 1).
   * @returns {object|null} An object containing the updated mining progress, or null if task is not found.
   * The returned object has the following properties:
   * - extracted (number): The updated number of messages already extracted.
   * - fetched (number): The updated number of messages already fetched.
   * - fetchingStatus (boolean): Indicates whether the fetching process has been completed or not.
   * @throws {Error} Throws an error if the `progressType` parameter is not set to either 'fetched' or 'extracted'.
   */
  #updateProgress(miningId, progressType, incrementBy = 1) {
    if (!['fetched', 'extracted'].includes(progressType)) {
      throw Error('progressType value must be either fetched or extracted.');
    }

    const task = this.#ACTIVE_MINING_TASKS.get(miningId);

    if (task === undefined) {
      return null;
    }

    const { progress, fetcher } = task;

    progress[`${progressType}`] =
      (progress[`${progressType}`] || 0) + incrementBy;

    return { ...progress, fetchingStatus: fetcher.isCompleted };
  }

  /**
   * Checks whether a mining task has completed and deletes it if it has.
   * @async
   * @param {string} miningID - The ID of the mining task to check.
   * @param {Object} progress - An object containing the extracted and fetched progress for the task.
   * @param {number} progress.extracted - The number of messages already extracted.
   * @param {number} progress.fetched - The number of messages already fetched.
   * @param {boolean} progress.fetchingStatus - The status of the fetching process.
   * @returns {Promise<{status:boolean, taks:object}>} An object containing the status of the task and the task itself (if it has been deleted).
   */
  async #hasCompleted(miningID, { extracted, fetched, fetchingStatus }) {
    const status = fetchingStatus && extracted >= fetched;
    const { task } = status ? await this.deleteTask(miningID) : { task: null };

    return { status, task };
  }

  /**
   * Sends a message to the Pub/Sub system for managing streams.
   *
   * @param {string} miningId - The ID of the mining operation.
   * @param {string} command - The command to execute. Valid options are 'register' or 'delete'.
   * @param {object} streamInfo - An object conatining Stream name and consumer group name.
   * @param {string} streamInfo.streamName - The name of the stream.
   * @param {string} streamInfo.consumerGroupName - The name of the consumer group.
   * @throws {Error} Throws an error if an invalid command is provided.
   */
  async #pubsubSendMessage(
    miningId,
    command,
    { streamName, consumerGroupName }
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

/**
 * A factory for creating EmailFetcher instances.
 */
const EmailFetcherFactory = function () {
  return {
    /**
     * Creates a new EmailFetcher instance.
     * @param {object} options - An object containing the options for the email fetcher.
     * @param {string} options.email - The email address to connect to.
     * @param {string} options.userId - The ID of the user.
     * @param {number} options.batchSize - The number of emails to process before sending a notification.
     * @param {string[]} options.boxes - An array of strings specifying the email boxes to mine.
     * @param {object} options.imapConnectionProvider - A configured email connection provider object.
     * @param {string} options.miningId - The ID of the mining task.
     * @param {string} options.streamName - The name of the stream to publish mining events to.
     * @returns {ImapEmailsFetcher} A new instance of `ImapEmailsFetcher`.
     */
    create: ({
      imapConnectionProvider,
      boxes,
      userId,
      email,
      miningId,
      streamName,
      batchSize
    }) => {
      return new ImapEmailsFetcher(
        imapConnectionProvider,
        boxes,
        userId,
        email,
        miningId,
        streamName,
        batchSize
      );
    }
  };
};

/**
 * A factory for creating SSEBroadcasterFactory instances.
 */
const SSEBroadcasterFactory = function () {
  return {
    /**
     * Creates a new instance of `SSEBroadcasterClass`.
     * @returns {RealtimeSSE} - A new instance of `RealtimeSSE`.
     */
    create: () => {
      return new RealtimeSSE();
    }
  };
};

const miningTasksManager = new TasksManager(
  redis.getSubscriberClient(),
  redis.getClient(),
  new EmailFetcherFactory(),
  new SSEBroadcasterFactory()
);

module.exports = {
  miningTasksManager,
  TasksManager,
  redactSensitiveData
};
