import logger from '../utils/logger';

export default function errorLogger(err, _req, _res, next) {
  logger.error(err.message, {
    metadata: {
      error: err
    }
  });

  next(err);
}
