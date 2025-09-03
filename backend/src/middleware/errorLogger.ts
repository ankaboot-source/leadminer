import { NextFunction, Request, Response } from 'express';
import logger from '../utils/logger';

export default function errorLogger(
  err: Error,
  _req: Request,
  _res: Response,
  next: NextFunction
) {
  logger.error('[middleware.errorLogger]:', err);

  next(err);
}
