import { NextFunction, Request, Response } from 'express';
import logger from '../utils/logger';

export default function errorLogger(
  err: Error,
  _req: Request,
  _res: Response,
  next: NextFunction
) {
  // err can be a non-Error value at runtime (e.g. next('boom'), throw null),
  // so guard before reading .message (see PR #2906 review).
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error(`[middleware.errorLogger]: ${message}`, {
    stack
  });

  next(err);
}
