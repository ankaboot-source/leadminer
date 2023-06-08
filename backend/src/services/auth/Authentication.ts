import { Logger } from 'winston';
import {
  AuthenticationClient,
  AuthenticationResolver,
  OAuthSigninOptions
} from './types';

export default class AuthResolver implements AuthenticationResolver {
  constructor(
    private readonly client: AuthenticationClient,
    private readonly logger: Logger
  ) {}

  async getUser(accessToken: string) {
    try {
      const { data, error } = await this.client.getUser(accessToken);

      if (error) {
        return { error };
      }
      const { id, email, role } = data.user;
      return { user: { id, email, role } };
    } catch (e) {
      this.logger.error('Failed to get authenticated user', e);
      throw e;
    }
  }

  async loginWithOneTimePasswordEmail(email: string) {
    try {
      const { error } = await this.client.signInWithOtp({ email });

      if (error) {
        return { error };
      }

      return { user: null };
    } catch (e) {
      this.logger.error('Failed to generate a login link for user', e);
      throw e;
    }
  }

  async signInWithOAuth(options: OAuthSigninOptions) {
    try {
      const { data, error } = await this.client.signInWithOAuth(options);

      if (error) {
        throw new Error(error.message);
      }

      const { url } = data;
      return { url };
    } catch (e) {
      this.logger.error('Failed to generate a OAuth login link.', e);
      throw e;
    }
  }
}
