import { NextFunction, Request, Response } from 'express';
import ENV from '../config';
import AuthResolver from '../services/auth/AuthResolver';
import supabase from '../utils/supabase';

export default function initializeAuthMiddleware(authResolver: AuthResolver) {
  const verifyJWT = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.split(' ')[1];
      // Check for service role authentication
      if (
        ENV.SUPABASE_SECRET_PROJECT_TOKEN &&
        token === ENV.SUPABASE_SECRET_PROJECT_TOKEN
      ) {
        // Extract userId from route or query params
        const userId = req.params.userId ?? req.query.userId;

        if (userId) {
          // Create a service user object with the extracted userId
          res.locals.user = (
            await supabase.auth.admin.getUserById(userId)
          ).data.user;
        }

        return next();
      }

      // Standard JWT validation
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
