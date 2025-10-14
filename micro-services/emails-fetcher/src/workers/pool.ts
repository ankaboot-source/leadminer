import os from 'os';
import { FixedThreadPool } from 'poolifier';
import path from 'path';
import type { WorkerTask } from './types';
import logger from '../utils/logger';

const maxThreads = Math.max(1, os.cpus().length - 1);

// Determine runtime folder
const isProd = !__dirname.includes('src');

// Worker path: compiled .js always
const workerPath = path.resolve(
  isProd
    ? path.resolve(__dirname, 'email-body-parser-publisher.js')
    : './dist/src/workers/email-body-parser-publisher.js'
);

logger.info('[WorkerPool] Using worker file:', workerPath);

const workerPool = new FixedThreadPool<WorkerTask, { success: boolean }>(
  maxThreads,
  workerPath,
  {
    onlineHandler: () => logger.debug('[WorkerPool] Worker thread online'),
    exitHandler: () => logger.debug('[WorkerPool] Worker thread exited'),
    errorHandler: (e) => logger.error('[WorkerPool] Worker error:', e)
  }
);

export default workerPool;
