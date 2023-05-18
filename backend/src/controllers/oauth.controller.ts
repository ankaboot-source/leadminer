import { Request, Response, NextFunction } from 'express';
import {
  OAUTH_PROVIDERS,
  AUTH_SERVER_URL,
  AUTH_SERVER_CALLBACK
} from '../config';

import {
  buildEndpointURL,
  buildRedirectUrl,
  encodeJwt,
  decodeJwt,
  JwtState,
  AuthorizationParams,
  UserDetails,
  createOAuthClient,
  findOrCreateOne
} from '../utils/helpers/oauthHelpers';

/**
 * Handles the OAuth callback and redirects the user based on the callback result.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @param {NextFunction} next - The Express next middleware function.
 * @throws {Error} If the required parameters are missing or invalid.
 */
export async function oauthCallbackHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> {
  const { state } = req.query;

  try {
    const { nosignup, provider, redirectURL } = decodeJwt(
      state as string
    ) as JwtState;

    if (typeof provider !== 'string') {
      throw new Error('Missing or invalid provider.');
    }

    if (!nosignup) {
      const redirectionURL = buildRedirectUrl(AUTH_SERVER_CALLBACK as string, {
        ...req.query
      });
      return res.redirect(redirectionURL);
    }

    const oauthProvider = OAUTH_PROVIDERS.find(({ name }) => name === provider);

    if (!oauthProvider) {
      throw new Error('Provider not supported.');
    }

    const client = createOAuthClient(
      oauthProvider,
      buildEndpointURL(req, '/api/oauth/callback')
    );

    const tokenSet = await client.callback(
      buildEndpointURL(req, '/api/oauth/callback'),
      req.query,
      { state: state as string }
    );

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

    const userInfo = decodeJwt(tokenSet.id_token as string) as Record<
      string,
      any
    >;
    const user = await findOrCreateOne(
      userInfo.email,
      tokenSet.refresh_token as string
    );
    const account: UserDetails = {
      id: user.id,
      email: user.email,
      accessToken: tokenSet.access_token as string
    };

    if (redirectURL) {
      const redirectionURL = buildRedirectUrl(redirectURL, account);
      return res.redirect(redirectionURL);
    }

    return res.status(200).json({ error: null, data: account });
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
export function oauthHandler(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const { nosignup, provider, scopes } = req.query;

    if (typeof provider !== 'string') {
      throw new Error('Missing or invalid provider.');
    }

    const oauthProvider = OAUTH_PROVIDERS.find(({ name }) => name === provider);

    if (!oauthProvider) {
      return next(new Error('Requested provider not supported.'));
    }

    const redirectURL = req.query.redirect_to;

    const authorizationParams: AuthorizationParams = {
      provider,
      scopes: oauthProvider.scopes
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

      authorizationParams.state = encodeJwt(stateParams);
      authorizationParams.access_type = 'offline';
    }

    const queryParams = new URLSearchParams(
      authorizationParams as Record<string, any>
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
