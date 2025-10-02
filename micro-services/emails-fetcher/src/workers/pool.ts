import os from 'os'
import type { WorkerTask } from './types'
import { FixedThreadPool } from 'poolifier'
import path from 'path'

const maxThreads = Math.max(1, os.cpus().length - 1)




// Determine runtime folder
const isProd = !__dirname.includes('src')

// Worker path: compiled .js always
const workerPath = path.resolve(
  isProd ? path.resolve(__dirname, 'email-body-parser-publisher.js') :
  './dist/src/workers/email-body-parser-publisher.js'
)

console.log('[WorkerPool] Using worker file:', workerPath)
export const workerPool = new FixedThreadPool<WorkerTask, { success: boolean }>(
  maxThreads,
  workerPath,
  {
    onlineHandler: () => console.log('[WorkerPool] Worker thread online'),
    exitHandler: () => console.log('[WorkerPool] Worker thread exited'),
    errorHandler: e => console.error('[WorkerPool] Worker error:', e)
  }
)
