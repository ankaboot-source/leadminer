import { NextFunction, Request, Response } from 'express';

function notFound(req: Request, res: Response, next: NextFunction) {
  res.status(404);
  const error = new Error(
    `The endpoint you are trying to reach (${req.originalUrl}) does not exist.`
  );
  next(error);
}

export default notFound;
