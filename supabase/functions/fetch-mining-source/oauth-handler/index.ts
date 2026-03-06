import { Token } from "simple-oauth2";
import googleOAuth2Client from "./google.ts";
import azureOAuth2Client from "./azure.ts";
import { createLogger } from "../../_shared/logger.ts";

export type TokenType = {
  refreshToken: string;
  accessToken: string;
  idToken: string;
  expiresAt: number;
};

export interface ImapMiningSourceCredentials {
  email: string;
  password: string;
  host: string;
  port: number;
  tls: boolean;
}

export type OAuthMiningSourceProvider = "azure" | "google";
export type MiningSourceType = OAuthMiningSourceProvider | "imap";

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

export function getAuthClient(provider: OAuthMiningSourceProvider) {
  switch (provider) {
    case "google":
      return googleOAuth2Client;
    case "azure":
      return azureOAuth2Client;
    default:
      throw new Error("Not a valid OAuth provider");
  }
}

export function isTokenExpired(
  credentials: OAuthMiningSourceCredentials,
  nowMs = 1000,
): boolean {
  const client = getAuthClient(credentials.provider);

  const token = client.createToken({
    access_token: credentials.accessToken,
    refresh_token: credentials.refreshToken,
    expires_at: credentials.expiresAt,
  });
  return token.expired(nowMs);
}

export async function refreshAccessToken(
  OAuthCredentials: OAuthMiningSourceCredentials,
): Promise<Token> {
  try {
    const authClient = getAuthClient(OAuthCredentials.provider);

    const token = {
      access_token: OAuthCredentials.accessToken,
      refresh_token: OAuthCredentials.refreshToken,
      expires_at: OAuthCredentials.expiresAt,
    };

    const tokenInstance = authClient.createToken(token);

    const refreshed = await tokenInstance.refresh();
    const refreshedToken = refreshed.token;

    return refreshedToken;
  } catch (error) {
    createLogger("refreshAccessToken").error("Failed to refresh access token");
    throw error;
  }
}
