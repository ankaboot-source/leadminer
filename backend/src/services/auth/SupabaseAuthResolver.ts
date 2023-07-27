import { SupabaseClient } from '@supabase/supabase-js';
import { Request } from 'express';
import { Logger } from 'winston';
import AuthResolver from './AuthResolver';

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
        return undefined;
      }

      return data.user;
    } catch (e) {
      this.logger.error('Failed to get authenticated user', e);
      return undefined;
    }
  }

  async deleteUser(userid: string) {
    try {
      const { data, error } = await this.client.auth.admin.deleteUser(userid);

      if (error) {
        return undefined;
      }

      return data.user;
    } catch (e) {
      this.logger.error('Failed to delete authenticated user', e);
      return undefined;
    }
  }

  async invokeDeleteMiningData(userid: string) {
    try {
      await this.client.rpc('delete_user_and_related_data', { userid });
      return true;
    } catch (e) {
      this.logger.error('Failed to invoke database function "delete_user_and_related_data"', e);
      return undefined;
    }
  }
}
