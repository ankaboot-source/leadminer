import { Request, Response } from 'express';
import SSE from 'express-sse';
import logger from '../logger';

/**
 * RealtimeSSE extends SSE class and adds an `initSSE` method
 * that can be used to initialize the SSE with a single object parameter,
 * a `sendSSE` method that uses the existing send method and logs errors
 * and a `stop` method to end the SSE stream.
 *
 * @extends SSE
 */
export default class RealtimeSSE extends SSE {
  /**
   * Initializes the SSE stream with a single object parameter
   * containing the request and response objects.
   *
   */
  subscribeSSE({ req, res }: { req: Request; res: Response }) {
    this.on('stop', () => {
      // Make sure connection is not already closed before writing.
      // writableEnded: https://nodejs.org/api/http.html#responsewritableended

      if (res.writableEnded === false) {
        res.write('event: close\n');
        res.flushHeaders();
        res.end();
      }
    });
    this.init(req, res);
  }

  /**
   * Sends a Server-Sent Event (SSE) to the specified client with the given data and event name.
   * @param sseData - The data to be sent as part of the SSE.
   * @param sseEvent - The name of the event associated with the SSE.
   */
  sendSSE<T>(sseData: T, sseEvent: string) {
    try {
      this.send(sseData, sseEvent);
    } catch (error) {
      logger.error('Something happened when sending SSE', error);
    }
  }

  /**
   * Ends the SSE stream by emitting the 'stop' event.
   */
  stop() {
    return this.emit('stop');
  }
}
