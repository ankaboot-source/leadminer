import { normalizeEmail } from "../_shared/email.ts";

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

  let tokenUrl: string;
  let clientId: string;
  let clientSecret: string;

  if (kind === "google") {
    tokenUrl = "https://oauth2.googleapis.com/token";
    clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") || "";
    clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") || "";
  } else {
    tokenUrl = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
    clientId = Deno.env.get("AZURE_OAUTH_CLIENT_ID") || "";
    clientSecret = Deno.env.get("AZURE_OAUTH_CLIENT_SECRET") || "";
  }

  if (!clientId || !clientSecret) {
    return null;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const expiresAtInput = Number(source.credentials.expiresAt);
  if (!Number.isFinite(expiresAtInput) || expiresAtInput <= 0) {
    console.warn("Missing or invalid expiresAt in source credentials");
  }

  try {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!response.ok) {
      return null;
    }

    const tokenData = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    const nowMs = Date.now();
    const expiresAt = nowMs + tokenData.expires_in * 1000;

    return {
      ...source,
      credentials: {
        ...source.credentials,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || refreshToken,
        expiresAt: expiresAt,
      },
    };
  } catch (error) {
    console.error("Failed to refresh OAuth token:", error);
    return null;
  }
}

export function listUniqueSenderSources(
  sources: MiningSourceCredential[],
): MiningSourceCredential[] {
  const byEmail = new Map<string, MiningSourceCredential>();
  for (const source of sources) {
    const key = normalizeEmail(source.email);
    if (!key || byEmail.has(key)) continue;
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

  const expiresAt = Number(source.credentials.expiresAt);
  if (Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt <= nowMs) {
    return "OAuth token expired. Reconnect this source.";
  }

  return null;
}
