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
  id?: string;
  email: string;
  userId: string;
  credentials: ImapMiningSourceCredentials | OAuthMiningSourceCredentials;
  type: MiningSourceType;
  config?: Record<string, unknown>;
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
): boolean {
  const client = getAuthClient(credentials.provider);

  const token = client.createToken({
    access_token: credentials.accessToken,
    refresh_token: credentials.refreshToken,
    expires_at: credentials.expiresAt,
  });
  return token.expired(300);
}

/**
 * Classify an OAuth refresh error as a permanent rejection (the refresh token or
 * grant is dead and can never be refreshed again) vs a transient failure (retryable).
 *
 * - Permanent: Google/Azure `invalid_grant` (revoked access, app uninstalled, refresh
 *   token rotated/reset). An expired token that is otherwise valid is NOT permanent —
 *   it refreshes fine once network/token-server hiccups clear.
 * - Transient: network errors, 5xx, rate limits — should be retried, not acted on.
 */
function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value ?? "") ?? "";
  } catch {
    return "";
  }
}

export function isPermanentOAuthError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const body = (error as { data?: unknown })?.data;
  const bodyText =
    typeof body === "string"
      ? body
      : safeJsonStringify(body).toLowerCase();

  return (
    /invalid_grant/i.test(message) ||
    /invalid_grant/i.test(bodyText) ||
    /token.*(revoked|invalid|expired)|revoked (the )?(user )?(grant|token)/i.test(
      message,
    ) ||
    /token.*(revoked|invalid|expired)|revoked (the )?(user )?(grant|token)/i.test(
      bodyText,
    ) ||
    /invalid_grant/i.test(safeJsonStringify(error).toLowerCase())
  );
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
