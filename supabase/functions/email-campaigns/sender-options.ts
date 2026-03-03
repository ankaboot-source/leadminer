import { normalizeEmail } from "../_shared/email.ts";
import { createSupabaseAdmin } from "../_shared/supabase.ts";
import { createLogger } from "../_shared/logger.ts";

const logger = createLogger("sender-options");

export type MiningSourceCredential = {
  email: string;
  type: string;
  credentials: Record<string, unknown>;
};

export async function refreshOAuthToken(
  source: MiningSourceCredential,
): Promise<MiningSourceCredential | null> {
  const kind = source.type.trim().toLowerCase();
  if (kind !== "google" && kind !== "azure") {
    return null;
  }

  const refreshToken = String(source.credentials.refreshToken || "");
  if (!refreshToken) {
    return null;
  }

  logger.info("OAuth token refresh started", {
    email: source.email,
    provider: kind,
  });

  let tokenUrl: string;
  let clientId: string;
  let clientSecret: string;

  if (kind === "google") {
    tokenUrl = "https://oauth2.googleapis.com/token";
    clientId = Deno.env.get("GOOGLE_CLIENT_ID") || "";
    clientSecret = Deno.env.get("GOOGLE_SECRET") || "";
  } else {
    tokenUrl = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
    clientId = Deno.env.get("AZURE_CLIENT_ID") || "";
    clientSecret = Deno.env.get("AZURE_SECRET") || "";
  }

  logger.debug("OAuth client configuration", {
    email: source.email,
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
  });

  if (!clientId || !clientSecret) {
    logger.warn("OAuth client credentials missing", {
      email: source.email,
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
    });
    return null;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  try {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!response.ok) {
      const status = response.status;
      const body = await response.text();
      logger.error("OAuth token refresh failed", {
        email: source.email,
        status,
        responseBody: body,
      });
      return null;
    }

    const tokenData = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    const nowMs = Date.now();
    const expiresAt = nowMs + tokenData.expires_in * 1000;

    logger.info("OAuth token refreshed successfully", {
      email: source.email,
      expiresAt,
    });

    return {
      ...source,
      credentials: {
        ...source.credentials,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || refreshToken,
        expiresAt,
      },
    };
  } catch (error) {
    logger.error("OAuth token refresh exception", {
      email: source.email,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function updateMiningSourceCredentials(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  email: string,
  credentials: Record<string, unknown>,
): Promise<boolean> {
  if (!email || typeof email !== "string") {
    logger.error("Invalid email provided to update credentials", { email });
    return false;
  }

  const { error } = await supabaseAdmin
    .schema("private")
    .from("mining_sources")
    .update({ credentials })
    .eq("email", email);

  if (error) {
    logger.error("Failed to update mining source credentials", {
      email,
      error: error.message,
    });
    return false;
  }

  return true;
}

export function listUniqueSenderSources(
  sources: MiningSourceCredential[],
): MiningSourceCredential[] {
  const byEmail = new Map<string, MiningSourceCredential>();
  for (const source of sources) {
    const key = normalizeEmail(source.email);
    if (!key) {
      logger.warn("Skipping source with invalid email", {
        email: source.email,
      });
      continue;
    }
    if (byEmail.has(key)) continue;
    byEmail.set(key, source);
  }
  return [...byEmail.values()];
}

export function getSenderCredentialIssue(
  source: MiningSourceCredential,
  nowMs = Date.now(),
): string | null {
  const kind = source.type.trim().toLowerCase();
  if (kind !== "google" && kind !== "azure") {
    return null;
  }

  const expired = isTokenExpired(source.credentials, nowMs);
  if (expired) {
    logger.debug("Token expired detected", {
      email: source.email,
      expiresAt: source.credentials.expiresAt,
      now: nowMs,
    });
    return "OAuth token expired. Please reconnect this account in sources.";
  }

  return null;
}

export function isTokenExpired(
  credentials: Record<string, unknown>,
  nowMs = Date.now(),
): boolean {
  let expiresAt = credentials.expiresAt;

  // Handle both numeric timestamp and ISO date string
  if (typeof expiresAt === "string") {
    expiresAt = new Date(expiresAt).getTime();
  }

  const numericExpiresAt = Number(expiresAt);
  return (
    Number.isFinite(numericExpiresAt) &&
    numericExpiresAt > 0 &&
    numericExpiresAt <= nowMs
  );
}
