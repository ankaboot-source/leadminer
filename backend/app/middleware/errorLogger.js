const { logger } = require('../utils/logger');

function errorLogger(err, _req, _res, next) {
  logger.error(err.message, {
    metadata: {
      error: err
    }
  });

  next(err);
}

module.exports = {
  errorLogger
};
