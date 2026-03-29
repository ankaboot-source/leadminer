export interface ImapMiningSourceCredentials {
  email: string;
  password: string;
  host: string;
  port: number;
  tls: boolean;
}

export type OAuthMiningSourceProvider = 'azure' | 'google';
export type MiningSourceType = OAuthMiningSourceProvider | 'imap';

export interface PostgreSQLMiningSourceCredentials {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
}

export type PostgreSQLMiningSourceType = 'postgresql';
export type ExtendedMiningSourceType =
  | MiningSourceType
  | PostgreSQLMiningSourceType;

export interface OAuthMiningSourceCredentials {
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  provider: OAuthMiningSourceProvider;
}

interface BaseMiningSource {
  email: string;
  userId: string;
}

export interface ImapMiningSource extends BaseMiningSource {
  credentials: ImapMiningSourceCredentials;
  type: 'imap';
}

export interface OAuthMiningSource extends BaseMiningSource {
  credentials: OAuthMiningSourceCredentials;
  type: OAuthMiningSourceProvider;
}

export interface PostgreSQLMiningSource extends BaseMiningSource {
  credentials: PostgreSQLMiningSourceCredentials;
  type: 'postgresql';
}

export type MiningSource =
  | ImapMiningSource
  | OAuthMiningSource
  | PostgreSQLMiningSource;

export interface MiningSourceByUser {
  email: string;
  credentials:
    | ImapMiningSourceCredentials
    | OAuthMiningSourceCredentials
    | PostgreSQLMiningSourceCredentials;
  type: ExtendedMiningSourceType;
}

export interface MiningSources {
  upsert(source: MiningSource): Promise<void>;
  getByUser(
    userId: string
  ): Promise<(MiningSourceByUser & { passive_mining: boolean })[]>;
  /**
   * 
    getCredentialsBySourceEmail(
      userId: string,
      email: string
    ): Promise<
    (OAuthMiningSourceCredentials | ImapMiningSourceCredentials) | undefined
    >;
  */
  getSourcesForUser(userId: string, email?: string): Promise<MiningSource[]>;
}
