const { flickrBase58IdGenerator } = require('../utils/helpers/hashHelpers');
const { RealtimeSSE } = require('../utils/helpers/sseHelpers');
const { logger } = require('../utils/logger');
const { redis } = require('../utils/redis');
const { db } = require('../db');

/**
 * Removes sensitive data from a task object.
 *
 * @param {object} task - The task object to redact sensitive data from.
 * @returns {object} - A new task object with sensitive data removed.
 */
function redactSensitiveData(task) {
  return {
    task: {
      userId: task.userId,
      miningId: task.miningId,
      miningProgress: task.miningProgress,
      fetcher: {
        status: task.fetcher.isCompleted === true ? 'completed' : 'running',
        folders: task.fetcher.folders,
        bodies: task.fetcher.bodies,
        userId: task.fetcher.userId,
        userEmail: task.fetcher.userEmail
      }
    }
  };
}

class TasksManager {
  /**
   * The Map of active mining tasks, with mining ID as the key and mining task object as the value.
   * @type {Map<string, object>}
   */
  #ACTIVE_MINING_TASKS = new Map();

  constructor(redisClient) {
    this.progressSubscriber = redisClient;

    // Set up the Redis subscriber to listen for updates
    this.progressSubscriber.on('message', async (_, data) => {
      const { miningId, progressType } = JSON.parse(data);

      const progress = this.#updateProgress(miningId, progressType);
      const notified = this.#notifyChanges(miningId, progressType);

      const { status, task } = (progress !== null && notified !== null)
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
   * Creates a new mining task for a given user.
   * @param {string} miningId - The mining ID.
   * @param {string} userId - The user ID.
   * @param {object} fetcher - The fetcher instance used for mining.
   * @returns {object} - The new mining task.
   * @throws {Error} If a task with the same mining ID already exists.
   */
  createTask(miningId, userId, fetcher) {
    const task = this.#ACTIVE_MINING_TASKS.get(miningId);

    if (task === undefined) {
      const miningTask = {
        userId,
        miningId,
        miningProgress: {
          fetched: 0,
          extracted: 0
        },
        fetcher,
        progressHandlerSSE: new RealtimeSSE()
      };

      this.#ACTIVE_MINING_TASKS.set(miningId, miningTask);

      this.progressSubscriber.subscribe(miningId, (err) => {
        if (err) {
          logger.error('Failed subscribing to Redis.', { metadata: { err } });
        }
      });

      return redactSensitiveData(miningTask);
    }

    throw new Error(`Task with mining ID ${miningId} already exists.`);
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

    const { fetcher, progressHandlerSSE } = task;

    try {
      await fetcher.stop();
      await progressHandlerSSE.stop();
    } catch (error) {
      logger.error('Error when deleting task', { error });
    }

    this.#ACTIVE_MINING_TASKS.delete(miningId);

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

    const { fetcher, progressHandlerSSE, miningProgress } = task;
    const { fetched, extracted } = miningProgress;

    const eventName = `${progressType}-${miningId}`;

    // If the fetching is completed, notify the clients that it has finished.
    if (progressType === 'fetched') {
      const event = fetcher.isCompleted ? 'fetching-finished' : eventName;
      return progressHandlerSSE.sendSSE(fetched, event);
    }

    // Send the progress to parties subscribed on SSE
    return progressHandlerSSE.sendSSE(extracted, eventName);

  }

  /**
   * Updates the progress of a mining task with a given mining ID.
   * @param {string} miningId - The mining ID of the task to update progress for.
   * @param {string} progressType - The type of progress to update ('fetched' or 'extracted').
   * @param {number} incrementBy - The amount to increment progress by.
   * @returns {object || null} Returns the updated mining progress or null if task does not exist.
   */
  #updateProgress(miningId, progressType, incrementBy = 1) {
    if (!['fetched', 'extracted'].includes(progressType)) {
      throw Error('progressType value must be either fetched or extracted.');
    }

    const task = this.#ACTIVE_MINING_TASKS.get(miningId);

    if (task === undefined) {
      return null;
    }

    const { miningProgress } = task;
    miningProgress[`${progressType}`] += incrementBy;

    return { ...miningProgress };
  }

  /**
   * Checks whether a mining task has completed and deletes it if it has.
   * @param {string} miningID - The ID of the mining task to check.
   * @param {Object} progress - The extracted and fetched progress for the task.
   * @param {number} progress.extracted - The number of items extracted.
   * @param {number} progress.fetched - The number of items fetched.
   * @returns {Promise<{status:boolean, taks:object}>} An object containing status & task if status === true else status
   */
  async #hasCompleted(miningID, { extracted, fetched }) {
    const status = extracted === fetched;
    const { task } = status ? await this.deleteTask(miningID) : { task: null };

    return { status, task };
  }
}

const miningTasksManager = new TasksManager(redis.getDuplicatedClient());

module.exports = {
  miningTasksManager,
  TasksManager,
  redactSensitiveData
};
