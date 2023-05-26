import { Request } from 'express';
import jwt from 'jsonwebtoken';
import db from '../../db';

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

export interface OAuthUser {
  id: string;
  email: string;
  refresh_token: string;
}

/**
 * Constructs the full callback URL for an endpoint, based on the incoming request.
 * @param req - The incoming HTTP request.
 * @param endpointPath - The path of the endpoint to build the URL for.
 * @returns The fully-constructed URL.
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
  params: Record<string, string>
): string {
  try {
    const url = new URL(redirectURL);
    return `${url.href}?${new URLSearchParams(params).toString()}`;
  } catch (error) {
    throw new Error('Invalid redirectURL: Not a valid URL');
  }
}

/**
 * Decodes the provided JWT without verifying its authenticity.
 * @param token - The JWT to be decoded.
 * @returns The decoded payload if the token is valid.
 * @throws If the token is invalid or decoding fails.
 */
export function decodeJwt(token: string): jwt.JwtPayload {
  const decodedPayload = jwt.decode(token) as jwt.JwtPayload;
  if (!decodedPayload) {
    throw new Error('Invalid token: payload not found');
  }
  return decodedPayload;
}

/**
 * Finds or creates a user record using the provided email.
 * @param email - The email address of the Google user.
 * @param refreshToken - The refresh token of the Google user.
 * @throws If it fails to create or query the Google user.
 * @returns The Google user record that was found or created.
 */
export async function findOrCreateOne(
  email: string,
  refreshToken: string
): Promise<OAuthUser | null> {
  /**
   * Temporary implementation: This function serves as a temporary solution until
   * the application starts using the Gotrue user tables. It finds or creates a user
   * based on the provided email and registres all account under the same table as a google user.
   */
  const account = ((await db.getGoogleUserByEmail(email)) ??
    (await db.createGoogleUser({
      email,
      refresh_token: refreshToken
    }))) as OAuthUser;

  if (!account) {
    throw Error('Failed to create or query googleUser');
  }

  if (refreshToken && account.refresh_token !== refreshToken) {
    await db.updateGoogleUser(account.id, refreshToken);
  }

  return account;
}
