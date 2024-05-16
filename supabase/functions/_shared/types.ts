export type OAuthMiningSourceProvider = "azure" | "google";
export type MiningSourceType = OAuthMiningSourceProvider | "imap";

export type OAuthMiningSourceCredentials = {
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  provider: OAuthMiningSourceProvider;
};

type ImapMiningSourceCredentials = {
  email: string;
  password: string;
  host: string;
  port: number;
  tls: true;
};

export type Credentials =
  | ImapMiningSourceCredentials
  | OAuthMiningSourceCredentials;

export type MiningSource = {
  email: string;
  userId: string;
  credentials: Credentials;
  type: MiningSourceType;
};
