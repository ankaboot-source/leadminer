const logger = require('../utils/logger')(module);

function errorLogger(err, _req, _res, next) {
  logger.error(err.message, {
    error: err
  });

  next(err);
}

module.exports = {
  errorLogger
};
