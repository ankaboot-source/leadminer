import { User } from '@supabase/supabase-js';
import { NextFunction, Request, Response } from 'express';
import ENV from '../config';
import AuthResolver from '../services/auth/AuthResolver';

export default function initializeAuthMiddleware(authResolver: AuthResolver) {
  const verifyJWT = async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log('Received request !!');
      const authHeader = req.headers.authorization;
      const token = authHeader?.split(' ')[1];

      console.log('Yes', token === ENV.SUPABASE_SECRET_PROJECT_TOKEN);
      // Check for service role authentication
      if (
        ENV.SUPABASE_SECRET_PROJECT_TOKEN &&
        token === ENV.SUPABASE_SECRET_PROJECT_TOKEN
      ) {
        // Extract userId from route or query params
        const userId = req.params.userId ?? req.query.userId;

        if (userId) {
          // Create a service user object with the extracted userId
          const serviceUser: User = {
            id: userId,
            aud: 'authenticated',
            role: 'authenticated',
            email: undefined,
            email_confirmed_at: undefined,
            phone: undefined,
            phone_confirmed_at: undefined,
            confirmed_at: undefined,
            last_sign_in_at: undefined,
            app_metadata: {},
            user_metadata: {},
            identities: [],
            is_anonymous: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          res.locals.user = serviceUser;
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
