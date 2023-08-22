import { SupabaseClient } from '@supabase/supabase-js';
import { Request } from 'express';
import { Logger } from 'winston';
import AuthResolver from './AuthResolver';
import { Profile } from './types';

export default class SupabaseAuthResolver implements AuthResolver {
  private readonly headerKey = 'x-sb-jwt';

  constructor(
    private readonly client: SupabaseClient,
    private readonly logger: Logger
  ) {}

  getAccessToken(req: Request) {
    return req.header(this.headerKey);
  }

  async getUser(accessToken: string) {
    try {
      const { data, error } = await this.client.auth.getUser(accessToken);

      if (error) {
        throw error;
      }

      return data.user;
    } catch (e) {
      this.logger.error('Failed to get authenticated user', e);
      return undefined;
    }
  }

  async getProfile(userId: string) {
    try {
      const { data, error } = await this.client
        .from('profiles')
        .select('*')
        .match({ id: userId })
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    } catch (e) {
      this.logger.error('Failed to get user profile', e);
      return undefined;
    }
  }

  async updateProfile(userId: string, updateData: Partial<Profile>) {
    try {
      const { status, error } = await this.client
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

      if (error) {
        throw new Error(error.message);
      }

      return status === 204;
    } catch (error) {
      this.logger.error('Failed to update user profile', error);
      return undefined;
    }
  }

  async deleteUser(userId: string) {
    try {
      const { data, error } = await this.client.auth.admin.deleteUser(userId);

      if (error) {
        throw error;
      }

      return data.user;
    } catch (e) {
      this.logger.error('Failed to delete authenticated user', e);
      return undefined;
    }
  }

  async deleteUserData(userId: string) {
    try {
      const { error } = await this.client.rpc('delete_user_data', {
        userid: userId
      });

      if (error) {
        const postgresErrorMessage = `message=${error.message} | code=${error.code} | details=${error.details}`;
        throw new Error(postgresErrorMessage);
      }

      return true;
    } catch (e) {
      this.logger.error(
        'Failed to invoke database function "delete_user_data"',
        e
      );
      return undefined;
    }
  }
}
