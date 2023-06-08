import { SupabaseAuthClient } from '@supabase/supabase-js/dist/module/lib/SupabaseAuthClient';
import { Logger } from 'winston';
import { AuthClient } from '../AuthClient';
import { OAuthSigninOptions } from '../types';

export default class SupabaseAuthService implements AuthClient {
  constructor(
    private readonly authClient: SupabaseAuthClient,
    private readonly logger: Logger
  ) {}

  async getUser(accessToken?: string) {
    try {
      const { data, error } = await this.authClient.getUser(accessToken);

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
      const { error } = await this.authClient.signInWithOtp({ email });

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
      const { data, error } = await this.authClient.signInWithOAuth(options);

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
