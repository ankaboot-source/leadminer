export interface ImapMiningSourceCredentials {
  email: string;
  password: string;
  host: string;
  port: number;
}

export type OAuthMiningSourceProvider = 'Azure' | 'Google';
export type MiningSourceType = OAuthMiningSourceProvider | 'IMAP';

export interface OAuthMiningSourceCredentials {
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  provider: OAuthMiningSourceProvider;
}

export interface MiningSource {
  email: string;
  userId: string;
  credentials: ImapMiningSourceCredentials | OAuthMiningSourceCredentials;
  type: MiningSourceType;
}

export interface MiningSources {
  upsert(source: MiningSource): Promise<void>;
  getByUser(
    userId: string
  ): Promise<
    {
      email: string;
      type: MiningSourceType;
      credentials: ImapMiningSourceCredentials | OAuthMiningSourceCredentials;
    }[]
  >;
  getCredentialsBySourceEmail(
    userId: string,
    email: string
  ): Promise<
    (OAuthMiningSourceCredentials | ImapMiningSourceCredentials) | undefined
  >;
}
