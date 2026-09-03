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
 * Microsoft Entra STS error codes that document a dead grant (refresh token
 * expired, inactive, or revoked). Sources:
 * - https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow
 *   (error field contract; error_description "should not be used" for logic)
 * - https://learn.microsoft.com/en-us/entra/identity-platform/reference-error-codes
 */
const PERMANENT_AZURE_ERROR_CODES = new Set([
  "70000",
  "70008",
  "700082",
  "700084",
  "70043",
  "50173",
]);

interface ParsedOAuthError {
  message: string;
  /** OAuth `error` code from Google / Microsoft (documented contract). */
  error?: string;
  /** Azure numeric STS codes from `error_codes` or AADSTS### in prose. */
  codes: string[];
}

/**
 * Classify an OAuth refresh error as a permanent rejection (the refresh token or
 * grant is dead and can never be refreshed again) vs a transient failure (retryable).
 *
 * Signals are ordered by authority:
 * 1. `error === "invalid_grant"` — the documented OAuth error code from Google
 *    ("token ... expired or has been invalidated ... must be re-authorized") and
 *    Microsoft ("issued tokens ... no longer valid ... require re-authentication").
 * 2. Azure numeric `error_codes` containing a documented dead-grant STS code.
 * 3. Fallback: message-only `invalid_grant` for libraries that surface the code
 *    in the message but not in the body.
 *
 * The real runtime error shape is simple-oauth2's Boom error from @hapi/wreck:
 * `message = "Response Error: 400 Bad Request"` with the parsed JSON body at
 * `error.data.payload` — that is unwrapped first.
 */
function parseErrorPayload(error: unknown): ParsedOAuthError {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof (error as { message?: unknown } | null)?.message === "string"
        ? (error as { message: string }).message
        : String(error ?? "");
  const message = rawMessage;
  const root = (error as { data?: unknown })?.data;
  // simple-oauth2 / @hapi/wreck Boom error: body lives at data.payload
  const payloadCandidate =
    root && typeof root === "object"
      ? (root as Record<string, unknown>).payload ?? root
      : root;

  let errorCode = "";
  let codes: string[] = [];

  const readBody = (body: unknown): void => {
    if (typeof body === "string") {
      try {
        readBody(JSON.parse(body));
      } catch {
        // not JSON; message-scan fallback below
      }
      return;
    }
    if (!body || typeof body !== "object") return;
    const rec = body as Record<string, unknown>;
    if (typeof rec.error === "string") errorCode = rec.error;
    if (Array.isArray(rec.error_codes)) {
      codes = rec.error_codes
        .filter((c): c is string | number =>
          typeof c === "string" || typeof c === "number"
        )
        .map(String);
    }
  };

  readBody(payloadCandidate);

  // Some callers surface the parsed JSON body directly (no `data` wrapper).
  if (!errorCode && !codes.length) {
    readBody(error);
  }

  // Documented codes also appear inline in error_description / messages.
  if (!codes.length) {
    for (const code of PERMANENT_AZURE_ERROR_CODES) {
      if (message.includes(`AADSTS${code}`)) {
        codes.push(code);
        break;
      }
    }
  }
  return { message, error: errorCode, codes };
}

export function isPermanentOAuthError(error: unknown): boolean {
  const payload = parseErrorPayload(error);

  // Documented signal #1: the OAuth `error` field (Google + Microsoft).
  if (payload.error === "invalid_grant") {
    return true;
  }

  // Documented signal #2: Microsoft Entra STS error_codes for a dead grant.
  if (payload.codes.some((code) => PERMANENT_AZURE_ERROR_CODES.has(code))) {
    return true;
  }

  // Documented signal #3 (fallback): message-only `invalid_grant`.
  return /invalid_grant/i.test(payload.message);
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
