import { AuthResopnse, OAuthSigninOptions } from './types';

export interface AuthClient {
  getUser(accessToken: string): Promise<AuthResopnse>;
  loginWithOneTimePasswordEmail(email: string): Promise<AuthResopnse>;
  signInWithOAuth(options: OAuthSigninOptions): Promise<AuthResopnse>;
}
