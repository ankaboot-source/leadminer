import { Request, Response } from 'express';

export default function errorHandler(
  error: Error,
  _req: Request,
  res: Response
) {
  const code = res.statusCode !== 200 ? res.statusCode : 500;
  const response = {
    data: null,
    error
  };

  //   if (ENV.NODE_ENV === 'development') {
  //     response.error.stack = error.stack;
  //     response.error.message = error.message;
  //   }

  return res.status(code).send(response);
}
