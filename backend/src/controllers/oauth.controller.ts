import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import ENV from '../config';
import { OAuthUsers } from '../db/OAuthUsers';
import PROVIDER_POOL from '../services/auth/ProviderPool';
import {
  AuthorizationParams,
  buildEndpointURL,
  buildRedirectUrl
} from '../utils/helpers/oauthHelpers';

export default function initializeOAuthController(oAuthUsers: OAuthUsers) {
  return {
    /**
     * Retrieves the available providers and their associated domains.
     * @param _ - The request object (unused).
     * @param res - The response object.
     * @returns The response containing the OAuth providers and their domains.
     */
    GetOAuthProviders(_: Request, res: Response) {
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
    async oAuthCallbackHandler(
      req: Request,
      res: Response,
      next: NextFunction
    ) {
      let redirectTo = null;
      const { state } = req.query;

      try {
        const decodedState = jwt.decode(state as string);

        if (!decodedState || typeof decodedState !== 'object') {
          throw new Error('Invalid token: payload not found');
        }

        const { nosignup, provider, redirectURL } = decodedState;

        if (typeof provider !== 'string') {
          throw new Error('Missing or invalid provider.');
        }

        // If redirection URL is provided, the request will be redirected instead of responding with json.
        redirectTo = redirectURL;

        if (!nosignup) {
          const redirectionURL = buildRedirectUrl(ENV.AUTH_SERVER_CALLBACK, {
            ...req.query
          } as Record<string, string>);
          return res.redirect(redirectionURL);
        }

        const { oauthConfig } = PROVIDER_POOL.getProviderConfig({
          name: provider
        });
        const client = PROVIDER_POOL.oAuthClientFor({ name: provider });

        const tokenSet = await client.callback(
          buildEndpointURL(ENV.LEADMINER_API_HOST, '/api/oauth/callback'),
          req.query,
          { state: state as string }
        );

        const hasGrantedAllScopes = oauthConfig.scopes?.every((scope) => {
          if (scope.startsWith('https')) {
            return tokenSet.scope?.includes(scope);
          }
          return true;
        });

        if (!hasGrantedAllScopes) {
          const error =
            'Insufficient Permissions: All required permissions must be granted.';

          if (redirectTo) {
            const redirectionURL = buildRedirectUrl(redirectTo, { error });
            return res.redirect(redirectionURL);
          }
          return res.status(401).json({ error });
        }
        const data: { access_token?: string; email?: string; id?: string } = {
          access_token: tokenSet.access_token as string
        };
        /**
         *
         * Temporary implementation: Decode the JWT ID token to extract user info,
         * find or create a user based on the email and refresh token, and return the
         * user account details.
         *
         * This implementation is subject to change when using the Gotrue user tables.
         *
         */
        const userInfo = jwt.decode(
          tokenSet.id_token as string
        ) as jwt.JwtPayload;

        if (!userInfo) {
          throw new Error('Invalid token: payload not found');
        }

        const user = await oAuthUsers.findOrCreateOne(
          userInfo.email,
          tokenSet.refresh_token as string
        );

        if (user) {
          data.id = user.id;
          data.email = user.email;
        }

        if (redirectURL) {
          const redirectionURL = buildRedirectUrl(
            redirectURL,
            data as Record<string, string>
          );
          return res.redirect(redirectionURL);
        }
        return res.status(200).json({ data });
      } catch (err: any) {
        if (redirectTo) {
          return res.redirect(
            buildRedirectUrl(redirectTo, { error: err.message })
          );
        }
        return next(new Error(err.message));
      }
    },

    /**
     * Handles the OAuth flow and redirects the user to the authorization URL.
     * @param req - The Express request object.
     * @param res - The Express response object.
     * @param next - The Express next middleware function.
     * @throws If the required parameters are missing or invalid.
     */
    oAuthHandler(req: Request, res: Response, next: NextFunction) {
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
            ENV.LEADMINER_API_HASH_SECRET,
            {}
          );
          authorizationParams.access_type = 'offline';
        }

        const queryParams = new URLSearchParams(
          authorizationParams as unknown as Record<string, string>
        );
        const authorizationURL = `${
          ENV.AUTH_SERVER_URL
        }/authorize?${queryParams.toString()}`;

        // Redirect the user to the authorization URL
        return res.status(200).json({ data: { authorizationURL, provider } });
      } catch (error) {
        return next(error);
      }
    }
  };
}
