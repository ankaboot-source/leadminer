import { NextFunction, Request, Response } from 'express';

export default function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  next: NextFunction // eslint-disable-line @typescript-eslint/no-unused-vars
) {
  const code = res.statusCode !== 200 ? res.statusCode : 500;
  const response: { data: null; error: { message: string; stack?: string } } = {
    data: null,
    error: { message: error.message }
  };

  if (process.env.NODE_ENV === 'development') {
    if (error.stack) {
      response.error.stack = error.stack;
    }
  }

  return res.status(code).send(response);
}
