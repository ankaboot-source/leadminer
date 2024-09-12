import { NextFunction, Request, Response } from 'express';
import AuthResolver from '../services/auth/AuthResolver';

export default function initializeAuthMiddleware(authResolver: AuthResolver) {
  const verifyJWT = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accessToken = authResolver.getAccessToken(req);

      if (!accessToken) {
        return res
          .status(401)
          .json({ message: 'No token found, authorization denied' });
      }

      const user = await authResolver.getUser(accessToken);

      if (!user) {
        return res
          .status(401)
          .json({ message: 'No token found, authorization denied' });
      }

      res.locals.user = user;

      return next();
    } catch (error) {
      return res
        .status(500)
        .json({ error: { message: 'Oops! Something went wrong.' } });
    }
  };

  return verifyJWT;
}
