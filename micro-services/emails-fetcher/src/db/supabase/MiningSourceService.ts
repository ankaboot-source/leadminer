import { Logger } from 'winston';
import {
  ImapMiningSourceCredentials,
  MiningSource,
  MiningSources,
  MiningSourceType,
  OAuthMiningSourceCredentials
} from '../interfaces/MiningSources';
import supabaseClient from '../../utils/supabase';
import loggerUtil from '../../utils/logger';
import {
  edgeFunctionError,
  formatEdgeFunctionError
} from '../../utils/edgeFunctionError';

export interface MiningSourcesResponse {
  sources: {
    email: string;
    type: MiningSourceType;
    credentials: OAuthMiningSourceCredentials | ImapMiningSourceCredentials;
  }[];
  refreshed: string[];
}

export class MiningSourceService implements MiningSources {
  constructor(private readonly logger: Logger) {}

  async getSourcesForUser(
    userId: string,
    email?: string
  ): Promise<MiningSource[]> {
    const response = await supabaseClient.functions.invoke(
      'fetch-mining-source',
      {
        method: 'POST',
        body: {
          email: email ?? 'all',
          mode: 'service',
          user_id: userId
        }
      }
    );

    const { data, error } = response;

    if (error) {
      this.logger.error('Failed to fetch mining sources', {
        functionName: 'fetch-mining-source',
        status: error.context?.status,
        detail: formatEdgeFunctionError('fetch-mining-source', error)
      });
      throw edgeFunctionError('fetch-mining-source', error);
    }

    const result = data as MiningSourcesResponse;

    return result.sources.map((source) => ({
      userId,
      email: source.email,
      type: source.type,
      credentials: source.credentials
    }));
  }

  upsert(source: MiningSource): Promise<void> {
    this.logger.warn('Method getSourcesForUser not implemented');
    throw new Error(`Method not implemented, ${source.email}:${source.type}`);
  }

  getByUser(userId: string): Promise<
    {
      email: string;
      type: MiningSourceType;
      credentials: ImapMiningSourceCredentials | OAuthMiningSourceCredentials;
      passive_mining: boolean;
    }[]
  > {
    this.logger.warn('Method getSourcesForUser not implemented');
    throw new Error(`Method not implemented, ${userId}`);
  }
}

export const miningSourceService = new MiningSourceService(loggerUtil);
