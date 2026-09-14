import { Token } from "simple-oauth2";
import getGoogleOAuth2Client from "./google.ts";
import getAzureOAuth2Client from "./azure.ts";
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
      return getGoogleOAuth2Client();
    case "azure":
      return getAzureOAuth2Client();
    default:
      throw new Error("Not a valid OAuth provider");
  }
}

/**
 * Expiry window applied when deciding whether a token still works, in
 * milliseconds. Matches the previous simple-oauth2 `expired(300)` behavior
 * (300s headroom).
 */
const EXPIRY_WINDOW_MS = 300_000;

/**
 * Normalizes a stored `expiresAt` to epoch milliseconds.
 *
 * Historical storage units varied by write path: epoch ms (credentials saved
 * via POST /), an ISO string (older refresh write-backs), or seconds implied
 * by simple-oauth2's parser. Accepting all of them here (and writing back a
 * single canonical unit) is what makes the ms↔s ambiguity detectable instead
 * of silently never-expiring.
 */
export function normalizeExpiresAtMs(expiresAt: unknown): number | null {
  if (typeof expiresAt === "string") {
    const parsed = Date.parse(expiresAt);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt)) {
    return null;
  }
  // Values below ~10^11 (Sat Mar 03 5138) cannot be ms — they are seconds.
  // 10^11 ms ≈ 3170 AD; 10^11 s ≈ 5138 AD. All plausibly-current timestamps
  // in ms exceed 10^12, so this threshold cleanly separates the units.
  return expiresAt < 1e11 ? expiresAt * 1000 : expiresAt;
}

/**
 * True when the stored OAuth credentials are expired (or missing an expiry),
 * with the same 5-minute headroom the previous simple-oauth2-based check had.
 */
export function isTokenExpired(credentials: OAuthMiningSourceCredentials): boolean {
  const expiresAtMs = normalizeExpiresAtMs(credentials.expiresAt);
  if (expiresAtMs === null) {
    // No usable expiry info: force a refresh rather than trusting the token.
    return true;
  }
  return expiresAtMs - (Date.now() + EXPIRY_WINDOW_MS) <= 0;
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

/**
 * Canonical epoch-ms expiry for the refresh write-back, derived from the
 * refreshed token. simple-oauth2 hands back `expires_in` (seconds) alongside
 * a `Date`-typed `expires_at`; computing from `expires_in` avoids relying on
 * the parser's unit choice.
 */
export function refreshedExpiresAtMs(
  refreshedToken: Token,
): number {
  const expiresIn = refreshedToken["expires_in"];
  if (typeof expiresIn === "number" && Number.isFinite(expiresIn)) {
    return Date.now() + expiresIn * 1000;
  }
  const rawExpiresAt = refreshedToken["expires_at"];
  const parsed = rawExpiresAt instanceof Date
    ? rawExpiresAt.getTime()
    : normalizeExpiresAtMs(rawExpiresAt);
  return parsed ?? Date.now() + 3600_000;
}
