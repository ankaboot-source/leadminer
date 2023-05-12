import { Request } from 'express';
import { Strategy as OAuth2Strategy } from 'passport-oauth2';
import { Profile } from 'passport';
import jwt from 'jsonwebtoken';

export interface OauthProvider {
    name: string;
    authorizationURL: string;
    tokenURL: string;
    clientID: string;
    clientSecret: string;
}

export interface JwtState {
    nosignup?: boolean;
    provider?: string;
    redirectURL?: string;
}

export interface AuthorizationParams {
    redirect_to?: string
    provider: string;
    state?: string;
    scopes?: string
}

export interface OauthUser {
    accessToken: string,
    refreshToken: string
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
export function buildRedirectUrl(redirectURL: string, params: Record<string, any>): string {
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
 * Creates an OAuth2 strategy based on the specified provider name.
 * @param {string} providerName - The name of the OAuth provider.
 * @param {OauthProvider[]} providersList - The list of supported OAuth providers.
 * @param {string} callbackURL - The callback URL to redirect to for tokens.
 * @returns {OAuth2Strategy} The configured OAuth2 strategy.
 * @throws {Error} If the provider is not supported.
 */
export function createOAuthStrategy(providerName: string, providersList: OauthProvider[], callbackURL: string): OAuth2Strategy {
    const provider = providersList.find(({ name }) => name === providerName);

    if (provider === undefined) {
        throw new Error(`Provider "${providerName}" not supported.`);
    }

    const { authorizationURL, tokenURL, clientID, clientSecret } = provider;
    const strategy = new OAuth2Strategy(
        {
            authorizationURL,
            tokenURL,
            clientID,
            clientSecret,
            callbackURL,
        },
        (
            accessToken: string,
            refreshToken: string,
            _: Profile,
            cb: any
        ) => {
            const oauthUserDetails: OauthUser = { accessToken, refreshToken };
            return cb(null, oauthUserDetails);
        }
    );

    return strategy;
}