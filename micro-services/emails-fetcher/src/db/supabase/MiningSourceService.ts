import { Logger } from 'winston';

import {
  ImapMiningSourceCredentials,
  MiningSourceType,
  OAuthMiningSourceCredentials
} from '../interfaces/MiningSources';
import supabaseClient from '../../utils/supabase';
import * as loggerModule from '../../utils/logger';

export interface MiningSourcesResponse {
  sources: {
    email: string;
    type: MiningSourceType;
    credentials: OAuthMiningSourceCredentials | ImapMiningSourceCredentials;
  }[];
  refreshed: string[];
}

export class MiningSourceService {
  constructor(private readonly logger: Logger) {}

  async getSourcesForUser(
    userId: string,
    email?: string
  ): Promise<MiningSourcesResponse> {
    const { data, error } = await supabaseClient.functions.invoke(
      'fetch-mining-source',
      {
        method: 'POST',
        body: {
          email: email || 'all',
          mode: 'service',
          user_id: userId
        }
      }
    );

    if (error) {
      this.logger.error('Failed to fetch mining sources', error);
      throw new Error(`Failed to fetch mining sources: ${error.message}`);
    }

    return data as MiningSourcesResponse;
  }
}

export const miningSourceService = new MiningSourceService(
  loggerModule.default
);
