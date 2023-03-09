const { generateUUID } = require('../utils/helpers/hashHelpers');
const { sendSSE } = require('../utils/helpers/sseHelpers');
const { logger } = require('../utils/logger');
const { redis } = require('../utils/redis');

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

  static #generateTaskMiningID(userId) {
    return `${userId}-${generateUUID()}`;
  }

  /**
   * Generates a unique mining ID for a given user.
   * @param {string} userId - The user ID.
   * @returns {string} - The unique mining ID.
   */
  generateMiningID(userId) {
    return TasksManager.#generateTaskMiningID(userId);
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
          fetching: 0,
          extracting: 0
        },
        fetcher,
        sseProgressHandler: null
      };

      this.#ACTIVE_MINING_TASKS.set(miningId, miningTask);

      this.progressSubscriber.subscribe(miningId, (err) => {
        if (err) {
          logger.error('Failed subscribing to Redis.', { metadata: { err } });
        }
      });

      return miningTask;
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

    return task === undefined ? null : { ...task };
  }

  /**
   * Attaches an SSE instance to a mining task.
   * @param {string} miningId - The mining ID.
   * @param {object} sseProgressHandler - The SSE instance to attach.
   * @returns {void}
   * @throws {Error} If a task with the given mining ID doesn't exist.
   */
  attachSSE(miningId, sseProgressHandler) {
    const task = this.#ACTIVE_MINING_TASKS.get(miningId);

    if (task === undefined) {
      throw new Error(`Task with mining ID ${miningId} doesn't exist.`);
    }

    task.sseProgressHandler = sseProgressHandler;
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

    const { fetcher } = task;

    try {
      await fetcher.cleanup();
    } catch (error) {
      logger.error('Error when deleting task', { error });
    }

    this.#ACTIVE_MINING_TASKS.delete(miningId);

    return task;
  }

  /**
   * Notifies the client of the progress of a mining task with a given mining ID.
   * @param {string} miningId - The mining ID of the task to notify progress for.
   * @param {string} progressType - The type of progress to notify ('fetching' or 'extracting').
   * @returns {void}
   * @throws {Error} Throws an error if the task with the given mining ID does not exist.
   */
  #notifyProgress(miningId, progressType) {
    const task = this.#ACTIVE_MINING_TASKS.get(miningId) || {};

    if (task === undefined) {
      throw new Error(`Task with mining ID ${miningId} doesn't exist.`);
    }

    const { sseProgressHandler, miningProgress } = task;

    if (!sseProgressHandler) {
      return null;
    }

    const { fetching, extracting } = miningProgress;
    const value =
      progressType === 'fetching' ? parseInt(fetching) : parseInt(extracting);
    const eventName = `${progressType}-${miningId}`;

    return sendSSE(sseProgressHandler, value, eventName);
  }

  /**
   * Updates the progress of a mining task with a given mining ID.
   * @param {string} miningId - The mining ID of the task to update progress for.
   * @param {string} progressType - The type of progress to update ('fetching' or 'extracting').
   * @param {number} incrementBy - The amount to increment progress by.
   * @returns {object} Returns the updated mining progress.
   * @throws {Error} Throws an error if the task with the given mining ID does not exist or if the progress type is invalid.
   */
  #updateProgress(miningId, progressType, incrementBy = 1) {
    if (!['fetching', 'extracting'].includes(progressType)) {
      throw Error('progressType value must be either fetching or extracting.');
    }

    const task = this.#ACTIVE_MINING_TASKS.get(miningId);

    if (task === undefined) {
      throw new Error(`Task with mining ID ${miningId} doesn't exist.`);
    }

    const { miningProgress } = task;
    miningProgress[`${progressType}`] += incrementBy;

    return { ...miningProgress };
  }
}

const miningTasksManager = new TasksManager(redis.getDuplicatedClient());

module.exports = { miningTasksManager, TasksManager };
