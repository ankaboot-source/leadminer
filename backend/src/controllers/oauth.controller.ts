import jwt from 'jsonwebtoken';
import { NextFunction, Request, Response } from 'express';
import ENV from '../config';
import {
  buildEndpointURL,
  buildRedirectUrl
} from '../utils/helpers/oauthHelpers';
import PROVIDER_POOL from '../services/auth/Provider';
import { ProviderName, AuthResolver } from '../services/auth/types';

export default function initializeOAuthController(
  authResolver: AuthResolver
) {
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

        const { no_signup: noSignup, provider, redirectURL } = decodedState;

        if (typeof provider !== 'string') {
          throw new Error('Missing or invalid provider.');
        }

        // If redirection URL is provided, the request will be redirected instead of responding with json.
        redirectTo = redirectURL;

        if (!noSignup) {
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
        const parameters = { provider_token: tokenSet.access_token as string };

        if (redirectURL) {
          const redirectionURL = buildRedirectUrl(redirectURL, parameters, '#');
          return res.redirect(redirectionURL);
        }
        return res.status(200).json({ data: parameters });
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
    async oAuthHandler(req: Request, res: Response, next: NextFunction) {
      try {
        const { no_signup: noSignup, provider, scopes } = req.query;

        if (typeof provider !== 'string') {
          throw new Error('Missing or invalid provider.');
        }

        if (scopes && typeof scopes !== 'string') {
          throw new Error(
            'Invalid parmeter: Type of param scopes should a string.'
          );
        }

        const { oauthConfig } = PROVIDER_POOL.getProviderConfig({
          name: provider
        });

        if (!oauthConfig) {
          return next(new Error('Requested provider not supported.'));
        }

        const redirectURL = req.query.redirect_to as string;
        const scopesString = [scopes, ...(oauthConfig.scopes ?? [])]
          .filter(Boolean)
          .join(' ');

        const options = {
          scopes: scopesString,
          redirectTo: redirectURL,
          queryParams: {}
        };

        if (noSignup === 'true') {
          const requestState = { no_signup: noSignup, provider, redirectURL };
          const JwtEncodedState = jwt.sign(
            requestState,
            ENV.LEADMINER_API_HASH_SECRET
          );

          options.queryParams = { state: JwtEncodedState };
        }

        const { url, error } = await authResolver.signInWithOAuth({
          provider: provider as ProviderName,
          options
        });

        if (error) {
          throw new Error(error.message);
        }

        // Redirect the user to the authorization URL
        return res.status(200).json({ data: { url, provider } });
      } catch (error) {
        return next(error);
      }
    }
  };
}
