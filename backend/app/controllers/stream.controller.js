const { SSE } = require('express-sse');
const { redis } = require('../utils/redis');
const logger = require('../utils/logger')(module);

const redisPubSubClient = redis.getDuplicatedClient();

/**
 * Stream the progress of email extraction and scanning via Server-Sent Events (SSE).
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 */
async function streamProgress(req, res) {
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
      sse.send(extractedEmailMessages, `ExtractedEmails${userid}`);
    } else if (channel === fetchingChannel) {
      sse.send(parseInt(data), `ScannedEmails${userid}`);
    } else if (channel === authChannel) {
      sse.send({ token: data }, `token${userid}`);
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
