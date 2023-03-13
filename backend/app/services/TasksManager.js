const { generateUUID } = require('../utils/helpers/hashHelpers');
const { RealtimeSSE } = require('../utils/helpers/sseHelpers');
const { logger } = require('../utils/logger');
const { redis } = require('../utils/redis');

/**
 * Generates a unique mining ID for a given user.
 * @param {string} userId - The user ID.
 * @returns {string} - The unique mining ID.
 */
function generateMiningId() {
  const uuid = generateUUID().split('-');
  return uuid.map((i) => i.slice(0, 2)).join('');
}

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

    this.progressSubscriber.on('message', (_, data) => {
      const { miningId, progressType } = JSON.parse(data);

      this.#updateProgress(miningId, progressType);
      this.#notifyProgress(miningId, progressType);
    });
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
      await fetcher.cleanup();
      await progressHandlerSSE.stop();
    } catch (error) {
      logger.error('Error when deleting task', { error });
    }

    this.#ACTIVE_MINING_TASKS.delete(miningId);

    return redactSensitiveData(task);
  }

  /**
   * Notifies the client of the progress of a mining task with a given mining ID.
   * @param {string} miningId - The mining ID of the task to notify progress for.
   * @param {string} progressType - The type of progress to notify ('fetched' or 'extracted').
   * @returns Returns null if task does not exist.
   */
  #notifyProgress(miningId, progressType) {
    const task = this.#ACTIVE_MINING_TASKS.get(miningId);
    const { progressHandlerSSE, miningProgress } = task || {};

    if (task === undefined || !progressHandlerSSE) {
      return null;
    }

    const { fetched, extracted } = miningProgress;
    const value =
      progressType === 'fetched' ? parseInt(fetched) : parseInt(extracted);
    const eventName = `${progressType}-${miningId}`;

    return progressHandlerSSE.sendSSE(value, eventName);
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
}

const miningTasksManager = new TasksManager(redis.getDuplicatedClient());

module.exports = {
  miningTasksManager,
  TasksManager,
  generateMiningId,
  redactSensitiveData
};
