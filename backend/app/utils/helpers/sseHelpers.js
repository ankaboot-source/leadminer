const { logger } = require('../logger');

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

module.exports = {
    sendSSE
};