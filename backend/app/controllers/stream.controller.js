const { SSE } = require('express-sse');
const { miningTasksManager } = require('../services/TaskManager');

/**
 * Stream the progress of email extraction and scanning via Server-Sent Events (SSE).
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 */
function streamProgress(req, res) {
  const { id } = req.params;

  const sse = new SSE();

  sse.init(req, res);

  miningTasksManager.attachSSE(id, sse);

  // When the client closes the connection, unsubscribe from Redis channels and end the response.
  req.on('close', () => {
    miningTasksManager.deleteTask(id); // Stops the mining task.
  });
}

module.exports = {
  streamProgress
};
