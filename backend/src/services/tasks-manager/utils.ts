/* eslint-disable import/prefer-default-export */

import { RedactedTask, Task } from './types';

/**
 * Removes sensitive data from a task object.
 *
 * @param task - The task object to redact sensitive data from.
 * @returns - A new task object with sensitive data removed.
 */
export function redactSensitiveData(task: Task): RedactedTask {
  return {
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
  };
}
