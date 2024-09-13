import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from 'winston';
import { Users } from '../interfaces/Users';
import { Profile } from '../types';

export default class SupabaseUsers implements Users {
  constructor(
    private readonly client: SupabaseClient,
    private readonly logger: Logger
  ) {}

  async getById(userId: string) {
    try {
      const { data, error } = await this.client
        .from('profiles')
        .select('*')
        .match({ user_id: userId });

      if (error) {
        throw new Error(error.message);
      }

      return data[0];
    } catch (e) {
      this.logger.error('Failed to get user profile', e);
      return undefined;
    }
  }

  async update(userId: string, updateData: Partial<Profile>) {
    try {
      const { status, error } = await this.client
        .from('profiles')
        .update(updateData)
        .eq('user_id', userId);

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
        user_id: userId
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
