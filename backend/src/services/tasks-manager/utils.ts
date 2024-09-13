/* eslint-disable import/prefer-default-export */

import { customAlphabet } from 'nanoid/async';
import ENV from '../../config';
import { FLICKR_BASE_58_CHARSET } from '../../utils/constants';
import { MiningTask, RedactedTask } from './types';

/**
 * Removes sensitive data from a task object.
 *
 * @param task - The task object to redact sensitive data from.
 * @returns - A new task object with sensitive data removed.
 */
export function redactSensitiveData(task: MiningTask): RedactedTask {
  return {
    userId: task.userId,
    miningId: task.miningId,
    progress: {
      ...task.progress
    }
  };
}

/**
 * Generates a random ID string using the Flickr Base58 encoding scheme.
 */
export function flickrBase58IdGenerator() {
  return customAlphabet(
    FLICKR_BASE_58_CHARSET,
    ENV.LEADMINER_MINING_ID_GENERATOR_LENGTH
  );
}
