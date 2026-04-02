import { Logger } from 'winston';
import {
  ExtendedMiningSourceType,
  ImapMiningSourceCredentials,
  MiningSource,
  MiningSourceByUser,
  MiningSources,
  OAuthMiningSourceProvider,
  OAuthMiningSourceCredentials
} from '../interfaces/MiningSources';
import supabaseClient from '../../utils/supabase';
import loggerUtil from '../../utils/logger';

export interface MiningSourcesResponse {
  sources: {
    email: string;
    type: ExtendedMiningSourceType;
    credentials: OAuthMiningSourceCredentials | ImapMiningSourceCredentials;
  }[];
  refreshed: string[];
}

function isOAuthSourceType(type: string): type is OAuthMiningSourceProvider {
  return type === 'google' || type === 'azure';
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
          ...(email && { email }),
          user_id: userId
        }
      }
    );

    const { data, error } = response;

    if (error) {
      this.logger.error('Failed to fetch mining sources', { error });
      throw new Error(`Failed to fetch mining sources: ${error.message}`);
    }

    const result = data as MiningSourcesResponse;

    return result.sources.map((source) => {
      if (source.type === 'imap') {
        return {
          userId,
          email: source.email,
          type: source.type,
          credentials: source.credentials as ImapMiningSourceCredentials
        };
      }

      if (isOAuthSourceType(source.type)) {
        return {
          userId,
          email: source.email,
          type: source.type,
          credentials: source.credentials as OAuthMiningSourceCredentials
        };
      }

      throw new Error(`Unsupported source type from supabase: ${source.type}`);
    });
  }

  upsert(source: MiningSource): Promise<void> {
    this.logger.warn('Method getSourcesForUser not implemented');
    throw new Error(`Method not implemented, ${source.email}:${source.type}`);
  }

  getByUser(
    userId: string
  ): Promise<(MiningSourceByUser & { passive_mining: boolean })[]> {
    this.logger.warn('Method getSourcesForUser not implemented');
    throw new Error(`Method not implemented, ${userId}`);
  }
}

export const miningSourceService = new MiningSourceService(loggerUtil);
