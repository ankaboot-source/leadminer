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
    id?: string;
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
      this.logger.error('Failed to fetch mining sources', {
        error,
        status: error.context?.status,
        code: (error as { context?: { code?: string } }).context?.code
      });
      const status = error.context?.status as number | undefined;
      const code = (error as { context?: { code?: string } }).context?.code;
      // Propagate a deauthorized OAuth source as 401 so callers (e.g. IMAP box
      // fetch) can surface "reconnect needed" instead of a generic failure.
      if (status === 401 || code === 'OAUTH_NEEDS_REAUTH') {
        const reauthError = new Error(
          code === 'OAUTH_NEEDS_REAUTH'
            ? 'OAuth connection needs re-authentication'
            : `Failed to fetch mining sources: ${error.message}`
        );
        (reauthError as { status?: number }).status = 401;
        throw reauthError;
      }
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

  async getSourceById(
    sourceId: string,
    userId: string
  ): Promise<MiningSource | null> {
    const response = await supabaseClient.functions.invoke(
      'fetch-mining-source',
      {
        method: 'POST',
        body: {
          id: sourceId,
          user_id: userId
        }
      }
    );

    const { data, error } = response;

    if (error) {
      this.logger.error('Failed to fetch mining source by id', { error });
      throw new Error(`Failed to fetch mining source: ${error.message}`);
    }

    const result = data as MiningSourcesResponse;

    const source = result.sources?.[0];
    if (!source) return null;

    if (source.type === 'imap') {
      return {
        userId,
        email: source.email,
        type: source.type,
        id: sourceId,
        credentials: source.credentials as ImapMiningSourceCredentials
      };
    }

    if (isOAuthSourceType(source.type)) {
      return {
        userId,
        email: source.email,
        type: source.type,
        id: sourceId,
        credentials: source.credentials as OAuthMiningSourceCredentials
      };
    }

    throw new Error(`Unsupported source type from supabase: ${source.type}`);
  }

  upsert(source: MiningSource): Promise<string> {
    this.logger.warn('Method upsert not implemented');
    throw new Error(`Method not implemented, ${source.email}:${source.type}`);
  }

  delete(userId: string, email: string): Promise<boolean> {
    this.logger.warn('Method delete not implemented');
    throw new Error(`Method not implemented, ${userId}, ${email}`);
  }

  getByUser(
    userId: string
  ): Promise<(MiningSourceByUser & { passive_mining: boolean })[]> {
    this.logger.warn('Method getSourcesForUser not implemented');
    throw new Error(`Method not implemented, ${userId}`);
  }
}

export const miningSourceService = new MiningSourceService(loggerUtil);
