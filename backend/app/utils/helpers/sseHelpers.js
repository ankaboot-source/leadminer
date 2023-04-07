const { logger } = require('../logger');
const { SSE } = require('express-sse');

/**
 * RealtimeSSE extends SSE class and adds an `initSSE` method
 * that can be used to initialize the SSE with a single object parameter,
 * a `sendSSE` method that uses the existing send method and logs errors
 * and a `stop` method to end the SSE stream.
 *
 * @extends SSE
 */
class RealtimeSSE extends SSE {
  /**
   * Initializes the SSE stream with a single object parameter
   * containing the request and response objects.
   *
   * @param {Object} connection - Object containing the request and response objects
   * @param {Object} connection.req - The request object
   * @param {Object} connection.res - The response object
   */
  subscribeSSE({ req, res }) {
    this.on('stop', () => {
      // Make sure connection is not already closed before writing.
      // writableEnded: https://nodejs.org/api/http.html#responsewritableended

      if (res.writableEnded === false) {
        res.write('event: close\n');
        res.write('data: Mining completed :)\n\n');
        res.flushHeaders();
        res.end();
      }
    });
    this.init(req, res);
  }

  /**
   * Sends a Server-Sent Event (SSE) to the specified client with the given data and event name.
   * @param {string} sseData - The data to be sent as part of the SSE.
   * @param {string} sseEvent - The name of the event associated with the SSE.
   */
  sendSSE(sseData, sseEvent) {
    try {
      this.send(sseData, sseEvent);
    } catch (error) {
      logger.error('Somthing happend when sending SSE', {
        metadata: { error }
      });
    }
  }

  /**
   * Ends the SSE stream by emitting the 'stop' event.
   */
  stop() {
    this.emit('stop');
  }
}

module.exports = {
  RealtimeSSE
};
