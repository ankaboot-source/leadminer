import { Request } from 'express';
import jwt from 'jsonwebtoken';
import { Issuer, Client } from 'openid-client';
import db from '../../db';

export interface OauthProvider {
  name: string;
  authorizationURL: string;
  tokenURL: string;
  clientID: string;
  clientSecret: string;
  scopes?: string[];
  issuerURL: string;
  userInfoURL: string;
  jwkURI: string;
}

export interface JwtState {
  provider: string;
  nosignup?: boolean;
  redirectURL?: string;
  scopes: string | string[];
}

export interface AuthorizationParams {
  redirect_to?: string;
  provider: string;
  state?: string;
  scopes?: string[];
  access_type?: string;
}

export interface UserDetails {
  id: string;
  email: string;
  accessToken: string;
}

/**
 * Constructs the full callback URL for an endpoint, based on the incoming request.
 * @param {express.Request} req - The incoming HTTP request.
 * @param {string} endpointPath - The path of the endpoint to build the URL for.
 * @returns {string} The fully-constructed URL.
 */
export function buildEndpointURL(req: Request, endpointPath: string): string {
  const baseURL = `${req.protocol}://${req.get('host')}`;
  const url = new URL(endpointPath, baseURL);

  return url.href;
}

/**
 * Builds a redirect URL with query parameters.
 * @param {string} redirectURL - The base URL for the redirect.
 * @param {Record<string, any>} params - The query parameters as an object.
 * @returns {string} The constructed redirect URL.
 * @throws {Error} If the redirectURL is not a valid URL.
 */
export function buildRedirectUrl(
  redirectURL: string,
  params: Record<string, any>
): string {
  try {
    const url = new URL(redirectURL);
    return `${url.href}?${new URLSearchParams(params).toString()}`;
  } catch (error) {
    throw new Error('Invalid redirectURL: Not a valid URL');
  }
}

/**
 * Encodes the provided payload object into a JWT.
 * @param {object} payload - The payload object to be encoded.
 * @returns {string} The encoded JWT.
 */
export function encodeJwt(payload: object): string {
  const secret = 'your-secret-key';
  const encodedToken = jwt.sign(JSON.stringify(payload), secret, {});
  return encodedToken;
}

/**
 * Decodes the provided JWT without verifying its authenticity.
 * @param {string} token - The JWT to be decoded.
 * @returns {JwtState | Record<string, any>} The decoded payload if the token is valid.
 * @throws {Error} If the token is invalid or decoding fails.
 */
export function decodeJwt(token: string): JwtState | Record<string, any> {
  const decodedPayload = jwt.decode(token) as JwtState;
  if (!decodedPayload) {
    throw new Error('Invalid token: payload not found');
  }
  return decodedPayload;
}

/**
 * Finds or creates a user record using the provided email.
 * @param {string} email - The email address of the Google user.
 * @param {string} refreshToken - The refresh token of the Google user.
 * @throws {Error} If it fails to create or query the Google user.
 * @returns {Promise<Record<string, any>>} The Google user record that was found or created.
 */
export async function findOrCreateOne(
  email: string,
  refreshToken: string
): Promise<Record<string, any>> {
  /**
   * Temporary implementation: This function serves as a temporary solution until
   * the application starts using the Gotrue user tables. It finds or creates a user
   * based on the provided email and registres all account under the same table as a google user.
   */
  const account: Record<string, any> =
    (await db.getGoogleUserByEmail(email)) ??
    (await db.createGoogleUser({ email, refresh_token: refreshToken }));

  if (!account) {
    throw Error('Failed to create or query googleUser');
  }

  if (refreshToken && account.refresh_token !== refreshToken) {
    await db.updateGoogleUser(account.id, refreshToken);
  }

  return {
    ...account
  };
}

/**
 * Creates an OAuth2 strategy based on the specified provider name.
 * @param {OauthProvider} provider - The OAuth provider config.
 * @param {string} callbackURL - The callback URL to redirect to for tokens.
 * @returns {Client} The configured OAuth2 strategy.
 * @throws {Error} If the provider is not supported.
 */
export function createOAuthClient(
  provider: OauthProvider,
  callbackURL: string
): Client {
  const {
    authorizationURL,
    tokenURL,
    issuerURL,
    userInfoURL,
    jwkURI,
    clientID,
    clientSecret
  } = provider;

  const issuer = new Issuer({
    issuer: issuerURL,
    authorization_endpoint: authorizationURL,
    token_endpoint: tokenURL,
    userinfo_endpoint: userInfoURL,
    jwks_uri: jwkURI
  });

  const client = new issuer.Client({
    client_id: clientID,
    client_secret: clientSecret,
    redirect_uris: [callbackURL],
    response_types: ['code']
  });

  return client;
}
