import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {
  AUTH_SERVER_URL,
  AUTH_SERVER_CALLBACK,
  PROVIDER_POOL,
  LEADMINER_API_HASH_SECRET
} from '../config';
import {
  buildEndpointURL,
  buildRedirectUrl,
  JwtState,
  AuthorizationParams
} from '../utils/helpers/oauthHelpers';

import findOrCreateOne from '../db/helpers';
import { OAuthUser, OAuthUsers } from '../db/OAuthUsers';

export default function initializeOAuthController(oAuthUsers: OAuthUsers) {
  return {
    /**
     * Retrieves the available providers and their associated domains.
     * @param _ - The request object (unused).
     * @param res - The response object.
     * @returns The response containing the OAuth providers and their domains.
     */
    GetOauthProviders(_: Request, res: Response) {
      const providers = PROVIDER_POOL.supportedProviders();
      return res.status(200).json(providers);
    },

    /**
     * Handles the OAuth callback and redirects the user based on the callback result.
     * @param req - The Express request object.
     * @param res - The Express response object.
     * @param next - The Express next middleware function.
     * @throws If the required parameters are missing or invalid.
     */
    async oauthCallbackHandler(
      req: Request,
      res: Response,
      next: NextFunction
    ) {
      const { state } = req.query;

      try {
        const decodedState = jwt.decode(state as string);

        if (!decodedState) {
          throw new Error('Invalid token: payload not found');
        }
        const { nosignup, provider, redirectURL } = decodedState as JwtState;

        if (typeof provider !== 'string') {
          throw new Error('Missing or invalid provider.');
        }

        if (!nosignup) {
          const redirectionURL = buildRedirectUrl(
            AUTH_SERVER_CALLBACK as string,
            {
              ...req.query
            } as Record<string, string>
          );
          return res.redirect(redirectionURL);
        }

        const client = PROVIDER_POOL.oAuthClientFor({ name: provider });
        const tokenSet = await client.callback(
          buildEndpointURL(
            `${req.protocol}://${req.get('host')}`,
            '/api/oauth/callback'
          ),
          req.query,
          { state: state as string }
        );

        const credentials: {
          id?: string;
          email?: string;
          access_token: string;
        } = {
          access_token: tokenSet.access_token as string
        };

        /**
         *  Original code.
         *
         *     if (redirectURL) {
         *        const redirectionURL = buildRedirectUrl(redirectURL, tokens);
         *        return res.redirect(redirectionURL);
         *      }
         *
         *      res.setHeader('Content-Type', 'application/json');
         *      return res.status(200).send({ error: null, data: tokens });
         *
         *  ----------------------------------------------------------------------
         * Temporary implementation: Decode the JWT ID token to extract user info,
         * find or create a user based on the email and refresh token, and return the
         * user account details.
         *
         * This implementation is subject to change when using the Gotrue user tables.
         */

        const userInfo = jwt.decode(
          tokenSet.id_token as string
        ) as jwt.JwtPayload;

        if (!userInfo) {
          throw new Error('Invalid token: payload not found');
        }

        const user: OAuthUser | null = await findOrCreateOne(
          oAuthUsers,
          userInfo.email,
          tokenSet.refresh_token as string
        );

        if (user) {
          credentials.id = user.id;
          credentials.email = user.email;
        }

        if (redirectURL) {
          const redirectionURL = buildRedirectUrl(redirectURL, credentials);
          return res.redirect(redirectionURL);
        }

        return res.status(200).json({ data: credentials });
      } catch (err) {
        return next(err);
      }
    },

    /**
     * Handles the OAuth flow and redirects the user to the authorization URL.
     * @param req - The Express request object.
     * @param res - The Express response object.
     * @param next - The Express next middleware function.
     * @throws If the required parameters are missing or invalid.
     */
    oauthHandler(req: Request, res: Response, next: NextFunction) {
      try {
        const { nosignup, provider, scopes } = req.query;

        if (typeof provider !== 'string') {
          throw new Error('Missing or invalid provider.');
        }

        const { oauthConfig } = PROVIDER_POOL.getProviderConfig({
          name: provider
        });

        if (!oauthConfig) {
          return next(new Error('Requested provider not supported.'));
        }

        const redirectURL = req.query.redirect_to;

        const authorizationParams: AuthorizationParams = {
          provider,
          scopes: []
        };

        if (typeof scopes === 'string') {
          authorizationParams.scopes?.push(scopes);
        }

        if (typeof redirectURL === 'string') {
          authorizationParams.redirect_to = redirectURL;
        }

        if (nosignup === 'true') {
          const stateParams = {
            nosignup: true,
            provider,
            redirectURL
          };

          if (oauthConfig.scopes) {
            authorizationParams.scopes?.push(...oauthConfig.scopes);
          }

          authorizationParams.state = jwt.sign(
            JSON.stringify(stateParams),
            LEADMINER_API_HASH_SECRET as string,
            {}
          );
          authorizationParams.access_type = 'offline';
        }

        const queryParams = new URLSearchParams(
          authorizationParams as unknown as Record<string, string>
        );
        const authorizationURL = `${AUTH_SERVER_URL}/authorize?${queryParams.toString()}`;

        // Redirect the user to the authorization URL
        return res
          .status(200)
          .json({ error: null, data: { authorizationURL, provider } });
      } catch (error) {
        return next(error);
      }
    }
  };
}
