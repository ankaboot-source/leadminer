import { NextFunction, Request, Response } from 'express';
import ENV from '../config';

export default function initializeAuthMiddleware() {
  const staticApiTokenVerification = (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const token = req.headers['x-api-token'];

    if (!token || token !== ENV.EMAIL_FETCHING_SERVICE_API_TOKEN) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    return next();
  };

  return staticApiTokenVerification;
}
