const { SSE } = require('express-sse');
const { redis } = require('../utils/redis');
const { logger } = require('../utils/logger');

const redisClient = redis.getDuplicatedClient();

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

/**
 * Stream the progress of email extraction and scanning via Server-Sent Events (SSE).
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 */
function streamProgress(req, res) {
  const { progress_id } = req.query;
  const sse = new SSE();

  let fetchingCounter = 0;
  let extractingCounter = 0;

  sse.init(req, res);

  const intervalId = setInterval(async () => {
    const { fetching, extracting } =
      (await redisClient.hgetall(progress_id)) || {};

    if (fetching && extracting) {
      if (fetching > fetchingCounter) {
        sendSSE(sse, parseInt(fetching), `ScannedEmails${progress_id}`);
      }

      if (extracting > extractingCounter) {
        sendSSE(sse, parseInt(extracting), `ExtractedEmails${progress_id}`);
      }

      fetchingCounter = fetching;
      extractingCounter = extracting;
    }
  }, 100);

  req.on('close', () => {
    // Cleanup everything when closing request.
    clearInterval(intervalId);
    res.end();
  });
}

module.exports = {
  streamProgress
};
