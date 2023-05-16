import logger from '../utils/logger';

export default function errorLogger(err, _req, _res, next) {
  logger.error(err.message, err);

  next(err);
}
