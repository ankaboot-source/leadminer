import os from 'os'
import type { WorkerTask } from './types'
import { FixedThreadPool } from 'poolifier'

// Important: poolifier loads worker files as separate threads
// so give it the path to the compiled worker file (.js, not .ts)
const maxThreads = Math.max(1, os.cpus().length - 1)

export const workerPool = new FixedThreadPool<WorkerTask, { success: boolean }>(
  maxThreads,
  './dist/workers/email-body-parser-publisher.js',
  {
    onlineHandler: () => console.log('[WorkerPool] Worker thread online'),
    exitHandler: () => console.log('[WorkerPool] Worker thread exited'),
    errorHandler: e => console.error('[WorkerPool] Worker error:', e)
  }
)
