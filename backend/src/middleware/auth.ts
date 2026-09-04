import { NextFunction, Request, Response } from 'express';
import ENV from '../config';
import AuthResolver from '../services/auth/AuthResolver';
import supabase from '../utils/supabase';

export default function initializeAuthMiddleware(authResolver: AuthResolver) {
  const verifyJWT = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.split(' ')[1];
      // Check for service role authentication. Edge Functions authenticate
      // backend calls with the Supabase service role key (their default secret),
      // which matches the backend's SUPABASE_SERVICE_ROLE_KEY from the same
      // cluster. Also accept SUPABASE_SECRET_PROJECT_TOKEN for backward compat.
      const isServiceToken =
        (ENV.SUPABASE_SECRET_PROJECT_TOKEN &&
          token === ENV.SUPABASE_SECRET_PROJECT_TOKEN) ||
        (ENV.SUPABASE_SERVICE_ROLE_KEY &&
          token === ENV.SUPABASE_SERVICE_ROLE_KEY);
      if (isServiceToken) {
        // Extract userId from route or query params
        const queryUserId = Array.isArray(req.query.userId)
          ? req.query.userId[0]
          : req.query.userId;
        const userId = req.params.userId ?? queryUserId;

        if (userId) {
          // Create a service user object with the extracted userId
          const { user } = (await supabase.auth.admin.getUserById(userId)).data;

          if (!user) {
            return res.status(404).json({
              message: 'User not found'
            });
          }

          res.locals.user = user;
          return next();
        }
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
