import { Request, Response, NextFunction } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';

function cookieParser(cookieString: string): Record<string, any> | null {
  const cookies: { [name: string]: string } = {};

  if (!cookieString) {
    return null;
  }

  cookieString.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts[0].trim();
    const value = parts[1].trim();
    cookies[name] = value;
  });
  return cookies;
}

export default function initializeAuthMiddleware(
  supabaseRestClient: SupabaseClient
) {
  return {
    /**
     * Middleware function to verify JSON Web Token (JWT) in the request and attaches user to res.locals.
     * @param req - The request object.
     * @param res - The response object.
     * @param next - The next middleware function.
     * @returns Promise that resolves when the middleware completes.
     */
    verifyJWT: async (req: Request, res: Response, next: NextFunction) => {
      try {
        let accessToken = null;
        const authHeader = req.header('Authorization');

        if (authHeader) {
          accessToken = authHeader?.replace('Bearer ', '').trim();
        } else if (req.headers.cookie) {
          const parsedCookie = cookieParser(req.headers.cookie);
          accessToken = parsedCookie
            ? parsedCookie['sb-access-token']
            : accessToken;
        }

        if (!accessToken) {
          return res
            .status(401)
            .json({ message: 'No token found, authorization denied' });
        }

        const { data, error } = await supabaseRestClient.auth.getUser(
          accessToken
        );

        if (error) {
          return res.status(401).json({ error });
        }

        const { user } = data;
        const { id, email, role } = user;
        res.locals.user = { id, email, role };
        return next();
      } catch (error) {
        return res
          .status(500)
          .json({ error: { message: 'Oops ! something wrong happend.' } });
      }
    },

    /**
     * Middleware function to verify JSON Web Token (JWT) stored in the request header cookie.
     *
     * @param req - The request object.
     * @param res - The response object.
     * @param next - The next middleware function.
     * @returns Promise that resolves when the middleware completes.
     */
    verifyJWTCookie: async (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      try {
        if (!req.headers.cookie) {
          const error = { message: 'Missing Cookie in request header.' };
          return res.status(404).json({ error });
        }

        const parsedCookie = cookieParser(req.headers.cookie);
        const accessToken = parsedCookie
          ? parsedCookie['sb-access-token']
          : null;

        if (!accessToken) {
          return res
            .status(401)
            .json({ message: 'No token found, authorization denied' });
        }

        const { data, error } = await supabaseRestClient.auth.getUser(
          accessToken
        );

        if (error) {
          return res.status(401).json({ error });
        }

        const { user } = data;
        const { id, email, role } = user;
        res.locals.user = { id, email, role };
        return next();
      } catch (error) {
        return res
          .status(500)
          .json({ error: { message: 'Oops ! something wrong happend.' } });
      }
    }
  };
}
