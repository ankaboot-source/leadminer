const { SSE } = require('express-sse');
const { redis } = require('../utils/redis');
const { logger } = require('../utils/logger');

const redisPubSubClient = redis.getDuplicatedClient();

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
    logger.error('Somthing happend when sending SSE', { error });
  }
}

/**
 * Stream the progress of email extraction and scanning via Server-Sent Events (SSE).
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 */
function streamProgress(req, res) {
  const sse = new SSE();
  const { userid } = req.query;

  const extractingChannel = `extracting-${userid}`;
  const fetchingChannel = `fetching-${userid}`;
  const authChannel = `auth-${userid}`;

  let extractedEmailMessages = 0;
  sse.init(req, res);

  // subscribe to unique channels to track progress.
  redisPubSubClient.subscribe(extractingChannel, (err) => {
    if (err) {
      logger.error('Failed subscribing to Redis.', { err });
    }
  });
  redisPubSubClient.subscribe(fetchingChannel, (err) => {
    if (err) {
      logger.error('Failed subscribing to Redis.', { err });
    }
  });
  redisPubSubClient.subscribe(authChannel, (err) => {
    if (err) {
      logger.error('Failed subscribing to Redis.', { err });
    }
  });
  redisPubSubClient.on('message', (channel, data) => {
    if (channel === extractingChannel) {
      extractedEmailMessages++;
      sendSSE(sse, extractedEmailMessages, `ExtractedEmails${userid}`);
    } else if (channel === fetchingChannel) {
      sendSSE(sse, parseInt(data), `ScannedEmails${userid}`);
    } else if (channel === authChannel) {
      sendSSE(sse, { token: data }, `token${userid}`);
    }
  });

  // When the client closes the connection, unsubscribe from Redis channels and end the response.
  req.on('close', () => {
    redisPubSubClient.unsubscribe(extractingChannel);
    redisPubSubClient.unsubscribe(fetchingChannel);
    redisPubSubClient.unsubscribe(authChannel);
    res.end();
  });
}

module.exports = {
  streamProgress
};
