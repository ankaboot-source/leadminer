import { NextFunction, Request, Response } from 'express';
import ENV from '../config';
import { ErrorResponse } from '../utils/errors';

export default function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  next: NextFunction // eslint-disable-line @typescript-eslint/no-unused-vars
) {
  const code = res.statusCode !== 200 ? res.statusCode : 500;

  const response: ErrorResponse = {
    message: error.message
  };

  if (ENV.NODE_ENV === 'development') {
    if (error.stack) {
      response.stack = error.stack;
    }
  }
  return res.status(code).send({ ...response });
}
