import { NextFunction, Request, Response } from 'express';
import ENV from '../config';

export default function errorHandler(
  error: any,
  _req: Request,
  res: Response,
  next: NextFunction // eslint-disable-line @typescript-eslint/no-unused-vars
) {
  const code = res.statusCode !== 200 ? res.statusCode : 500;
  const response: {
    error: { message: string; stack?: string; errors?: Record<string, string> };
  } = {
    error: { message: error.message }
  };

  if (error.errors) {
    response.error.errors = error.errors;
  }

  if (ENV.NODE_ENV === 'development') {
    if (error.stack) {
      response.error.stack = error.stack;
    }
  }

  return res.status(code).send(response);
}
