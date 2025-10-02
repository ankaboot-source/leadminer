// src/emailWorker.ts
import { parentPort } from 'worker_threads';
import { ThreadWorker } from 'poolifier'
import { simpleParser } from 'mailparser';

import type { WorkerTask } from './types';
import redis from '../utils/redis';

const redisClient = redis.getClient();

async function workerFn(task?: WorkerTask): Promise<{ success: boolean }> {
  
  if (!task) return { success: false }

  const { headersBuf, bodyTextBuf, emailTextMaxLength, from, date, header, seq,
          folderPath, signatureStream, userId, userEmail, userIdentifier,
          miningId, messageId } = task

  let text = ''

  try {
    if (bodyTextBuf && bodyTextBuf.length) {
      const raw = Buffer.concat([headersBuf, bodyTextBuf])
      const parsed = await simpleParser(raw, {
        skipHtmlToText: true,
        skipTextToHtml: true,
        skipImageLinks: true,
        skipTextLinks: true
      })
      text = parsed.text ? parsed.text.slice(0, emailTextMaxLength) : ''
    }
  } catch {
    text = ''
  }

  if (text.length && from && date) {
    await redisClient.xadd(
      signatureStream,
      '*',
      'message',
      JSON.stringify({
        type: 'email',
        data: {
          header: { from, messageId, messageDate: date, rawHeader: header },
          body: text,
          seqNumber: seq,
          folderPath,
          isLast: false
        },
        userId,
        userEmail,
        userIdentifier,
        miningId
      })
    )
  }

  return { success: true }
}

// Wrap with ThreadWorker so poolifier can use it
export default new ThreadWorker(workerFn)
