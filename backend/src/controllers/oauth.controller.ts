import passport = require('passport');
import { Request, Response, NextFunction } from 'express';
import { OAUTH_PROVIDERS, AUTH_SERVER_URL, AUTH_SERVER_CALLBACK } from '../config';

import { createOAuthStrategy, buildEndpointURL, buildRedirectUrl, encodeJwt, decodeJwt, JwtState, AuthorizationParams, OauthUser } from '../utils/helpers/oauthHelpers';


/**
 * Handles the OAuth callback and redirects the user based on the callback result.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @param {NextFunction} next - The Express next middleware function.
 */
export function oauthCallbackHandler(req: Request, res: Response, next: NextFunction) {
    const { state } = req.query;

    try {
        const { nosignup, provider, redirectURL } = decodeJwt(state as string) as JwtState | Record<string, any>


        if (provider === undefined || typeof provider !== 'string') {
            throw new Error('Missing or Invalid provider.');
        }

        if (nosignup === undefined || nosignup === false) {
            const redirectionURL = buildRedirectUrl(AUTH_SERVER_CALLBACK as string, { ...req.query });
            return res.redirect(redirectionURL);
        }

        const strategy = createOAuthStrategy(
            provider,
            OAUTH_PROVIDERS,
            buildEndpointURL(req, '/api/oauth/callback')
        );

        return passport.authenticate(strategy, (err: any, user: OauthUser) => {
            if (err) {
                return next(err);
            }
            if (!user) {
                return res.redirect('/signin');
            }

            if (redirectURL) {
                const redirectionURL = buildRedirectUrl(redirectURL, user)
                return res.redirect(redirectionURL)
            }
            res.setHeader('Content-Type', 'application/json');
            return res.status(200).send({ error: null, data: user });
        }
        )(req, res, next);

    } catch (err) {
        return next(err);
    }
}

/**
 * Handles the OAuth flow and redirects the user to the authorization URL.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @param {NextFunction} next - The Express next middleware function.
 * @throws {Error} If the required parameters are missing or invalid.
 */
export async function oauthHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const redirectURL = req.query.redirect_to
        const { nosignup, provider, scopes } = req.query;

        if (typeof provider !== 'string') {
            throw new Error('Missing or Invalid provider.');
        }

        const authorizationParams: AuthorizationParams = {
            provider: provider as string,
        };

        if (typeof scopes === 'string') {
            authorizationParams.scopes = scopes
        }
        
        if (typeof redirectURL === 'string') {
            authorizationParams.redirect_to = redirectURL
        }

        if (nosignup === 'true') {
            const stateParams = {
                nosignup: true,
                provider,
                redirectURL
            };
            authorizationParams.state = encodeJwt(stateParams)
        }
        
        const queryParams = new URLSearchParams(authorizationParams as Record<string, any>);
        const authorizationURL = `${AUTH_SERVER_URL}/authorize?${queryParams.toString()}`;

        // Redirect the user to the authorization URL
        return res.status(200).send({ error: null, data: { authorizationURL, provider } });
    } catch (error) {
        return next(error);
    }
}

