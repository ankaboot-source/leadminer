import { Request, Response, NextFunction } from 'express';
import { AuthenticationResolver } from '../services/auth/types';

function parseCookies(cookieString: string) {
  const cookies: Record<string, string> = {};

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
  authResolver: AuthenticationResolver
) {
  /**
   * Verifies the access token and returns the user object.
   * @param token - The access token.
   * @returns A promise that resolves to the user object if verified.
   * @throws {Error} If there is an error during token verification.
   */
  async function verify(token: string, res: Response, next: NextFunction) {
    try {
      const { user, error } = await authResolver.getUser(token);

      if (error) {
        return res.status(401).json({ error });
      }

      res.locals.user = user;

      return next();
    } catch (error) {
      return next(error);
    }
  }

  return {
    verifyJWT: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const accessToken = req
          .header('Authorization')
          ?.replace('Bearer ', '')
          .trim();

        if (!accessToken) {
          return res
            .status(401)
            .json({ message: 'No token found, authorization denied' });
        }

        return await verify(accessToken, res, next);
      } catch (error) {
        return res
          .status(500)
          .json({ error: { message: 'Oops! Something went wrong.' } });
      }
    },

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

        const parsedCookie = parseCookies(req.headers.cookie);
        const accessToken = parsedCookie
          ? parsedCookie['sb-access-token']
          : null;

        if (!accessToken) {
          return res
            .status(401)
            .json({ message: 'No token found, authorization denied' });
        }

        return await verify(accessToken, res, next);
      } catch (error) {
        return res
          .status(500)
          .json({ error: { message: 'Oops! Something went wrong.' } });
      }
    }
  };
}
