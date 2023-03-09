const { generateUUID } = require('../utils/helpers/hashHelpers');
const { logger } = require('../utils/logger');
const { redis } = require('../utils/redis');

/**
 * Sends a Server-Sent Event (SSE) to the specified client with the given data and event name.
 * @param {Object} sseClient - The SSE client to send the event to.
 * @param {string} sseData - The data to be sent as part of the SSE.
 * @param {string} sseEvent - The name of the event associated with the SSE.
 */
function sendSSE(sseClient, sseData, sseEvent) {
  try {
    sseClient.send(sseData, sseEvent);
  } catch (error) {
    logger.error('Somthing happend when sending SSE', { metadata: { error } });
  }
}

class TasksManager {
    
    /**
     * The Map of active mining tasks, with mining ID as the key and mining task object as the value.
     * @type {Map<string, object>}
     */
    #ACTIVE_MINING_TASKS = new Map();

  constructor() {
    this.progressSubscriber = redis.getDuplicatedClient();

    this.progressSubscriber.on('message', (_, data) => {
      const { miningID, progressType } = JSON.parse(data);

      this.#updateProgress(miningID, progressType);
      this.#notifyProgress(miningID, progressType);
    });
  }

  /**
   * Generates a unique mining ID for a given user.
   * @param {string} userID - The user ID.
   * @returns {string} - The unique mining ID.
   */
  generateMiningID(userID) {
    return `${userID}-${generateUUID()}`;
  }

  /**
   * Creates a new mining task for a given user.
   * @param {string} miningID - The mining ID.
   * @param {string} userID - The user ID.
   * @param {object} fetcherInstance - The fetcher instance used for mining.
   * @returns {object} - The new mining task.
   */
  createTask(miningID, userID, fetcherInstance) {
    const miningTask = {
      userID,
      miningID,
      miningProgress: {
        fetching: 0,
        extracting: 0
      },
      fetcherInstance,
      sseInstance: null
    };

    if (this.#ACTIVE_MINING_TASKS.has(miningID)) {
      return this.#ACTIVE_MINING_TASKS.get(miningID);
    }

    this.progressSubscriber.subscribe(miningID, (err) => {
      err &&
        logger.error('Failed subscribing to Redis.', { metadata: { err } });
    });

    this.#ACTIVE_MINING_TASKS.set(miningID, miningTask);
    return this.#ACTIVE_MINING_TASKS.get(miningID);
  }

  /**
   * Attaches an SSE instance to a mining task.
   * @param {string} miningID - The mining ID.
   * @param {object} sseInstance - The SSE instance to attach.
   * @returns {void}
   */
  attachSSE(miningID, sseInstance) {
    const miningTask = this.#ACTIVE_MINING_TASKS.get(miningID) || {};
    if (miningTask.sseInstance) {
      delete miningTask.sseInstance;
    }
    miningTask.sseInstance = sseInstance;
  }

  /**
   * Stops a mining task with a given mining ID.
   * @param {string} miningID - The mining ID of the task to stop.
   * @returns {void}
   */
  deleteTask(miningID) {
    if (!this.#ACTIVE_MINING_TASKS.has(miningID)) {
      return null;
    }

    const { fetcherInstance } = this.#ACTIVE_MINING_TASKS.get(miningID) || {};
    const task = { ...this.#ACTIVE_MINING_TASKS.get(miningID) };

    fetcherInstance && fetcherInstance.cleanup().then();
    this.#ACTIVE_MINING_TASKS.delete(miningID);

    return task;
  }

  /**
   * Notifies the client of the progress of a mining task with a given mining ID.
   * @param {string} miningID - The mining ID of the task to notify progress for.
   * @param {string} progressType - The type of progress to notify ('fetching' or 'extracting').
   * @returns {void}
   */
  #notifyProgress(miningID, progressType) {
    const miningTask = this.#ACTIVE_MINING_TASKS.get(miningID) || {};

    const { sseInstance, miningProgress } = miningTask;

    if (!sseInstance) {
      return;
    }

    const { fetching, extracting } = miningProgress;

    switch (progressType) {
      case 'fetching':
        return sendSSE(sseInstance, parseInt(fetching), `fetching-${miningID}`);
      case 'extracting':
        return sendSSE(
          sseInstance,
          parseInt(extracting),
          `extracting-${miningID}`
        );
      default:
    }
  }

  /**
   * Updates the progress of a mining task with a given mining ID.
   * @param {string} miningID - The mining ID of the task to update progress for.
   * @param {string} progressType - The type of progress to update ('fetching' or 'extracting').
   * @param {number} incrementBy - The amount to increment progress by.
   * @returns {number} Returns the incremented progress.
   */
  #updateProgress(miningID, progressType, incrementBy = 1) {
    const miningTask = this.#ACTIVE_MINING_TASKS.get(miningID) || {};

    const { miningProgress } = miningTask;

    if (!miningProgress || !['fetching', 'extracting'].includes(progressType)) {
      return;
    }

    miningProgress[`${progressType}`] += incrementBy;
  }
}

const miningTasksManager= new TasksManager();

module.exports = { miningTasksManager };
