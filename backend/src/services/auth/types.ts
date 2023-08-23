import { SupabaseAuthClient } from '@supabase/supabase-js/dist/module/lib/SupabaseAuthClient';

/**
 * Represents the authenticated user.
 */
interface AuthUser {
  id: string | undefined;
  email: string | undefined;
  role: string | undefined;
}

/**
 * Represents an authentication error.
 */
interface AuthError extends Error {
  status?: number;
}
/**
 * Represents the options for OAuth signin.
 */
export interface OAuthSigninOptions {
  provider: ProviderName;
  options: {
    scopes?: string;
    redirectTo?: string;
    queryParams?: Record<string, string>;
  };
}
export type AuthResponse = {
  url?: string | null;
  user?: AuthUser | null;
  error?: AuthError | null;
};
/**
 * Enum representing provider names.
 */
export type ProviderName = 'google' | 'azure';
/**
 * Configuration object for OAuth.
 */
export interface OAuthConfig {
  issuerURL: string;
  authorizationURL: string;
  userInfoURL: string;
  jwkURI: string;
  tokenURL: string;
  clientID: string;
  clientSecret: string;
  redirectURI?: string[];
  scopes?: string[];
}
/**
 * Configuration object for IMAP.
 */
export interface IMAPConfig {
  name: string;
  host: string;
  port: number;
}
export interface ProviderConfig {
  name: ProviderName;
  oauthConfig: OAuthConfig;
  imapConfig: IMAPConfig;
  domains: string[];
}

export type AuthenticationClient = SupabaseAuthClient;

/**
 * Represents an authentication resolver that provides methods for authentication operations.
 */
export interface AuthResolver {
  /**
   * Retrieves user information based on the provided access token.
   * @param accessToken The access token for authentication.
   * @returns A promise that resolves to an `AuthResponse` object.
   */
  getUser(accessToken: string): Promise<AuthResponse>;

  /**
   * Sends a one-time password email to the specified email address for login.
   * @param email The email address for the login request.
   * @returns A promise that resolves to an `AuthResponse` object.
   */
  loginWithOneTimePasswordEmail(email: string): Promise<AuthResponse>;

  /**
   * Initiates an OAuth signin process with the specified options.
   * @param options The options for the OAuth signin.
   * @returns A promise that resolves to an `AuthResponse` object.
   */
  signInWithOAuth(options: OAuthSigninOptions): Promise<AuthResponse>;
}
