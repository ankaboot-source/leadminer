const { SSE } = require('express-sse');
const { miningTasksManager } = require('../services/TasksManager');
const { logger } = require('../utils/logger');

/**
 * Stream the progress of email extraction and scanning via Server-Sent Events (SSE).
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 */
function streamProgress(req, res) {
  const { id } = req.params;

  const sse = new SSE();
  sse.init(req, res);

  try {
    miningTasksManager.attachSSE(id, sse);
  } catch (error) {
    sse.send(error.message, 'errors');
    res.end();
  }

  req.on('close', async () => {
    try {
      await miningTasksManager.deleteTask(id);
    } catch (error) {
      logger.error('Error when disconnecting from the stream.', {
        miningId: id
      });
    }
  });
}

module.exports = {
  streamProgress
};
