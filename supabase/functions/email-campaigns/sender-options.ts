import { normalizeEmail } from "../_shared/email.ts";
import { createSupabaseAdmin } from "../_shared/supabase.ts";

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

  console.log(
    "[OAuth] Token refresh START for:",
    source.email,
    "provider:",
    kind,
  );

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

  console.log(
    "[OAuth] Client ID configured:",
    !!clientId,
    "Client Secret configured:",
    !!clientSecret,
  );

  if (!clientId || !clientSecret) {
    console.warn(
      "[OAuth] Client ID/Secret MISSING for:",
      source.email,
      "- cannot refresh token",
    );
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
      console.error(
        "[OAuth] OAuth response NOT OK for:",
        source.email,
        "- status:",
        status,
        "body:",
        body,
      );
      return null;
    }

    const tokenData = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    const nowMs = Date.now();
    const expiresAt = nowMs + tokenData.expires_in * 1000;

    console.log(
      "[OAuth] Token refresh SUCCESS for:",
      source.email,
      "- new expiresAt:",
      expiresAt,
    );

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
    console.error(
      "[OAuth] Token refresh EXCEPTION for:",
      source.email,
      "- error:",
      error,
    );
    return null;
  }
}

export async function updateMiningSourceCredentials(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  email: string,
  credentials: Record<string, unknown>,
): Promise<boolean> {
  if (!email || typeof email !== "string") {
    console.error("Invalid email provided to updateMiningSourceCredentials");
    return false;
  }

  const { error } = await supabaseAdmin
    .from("mining_sources")
    .update({ credentials })
    .eq("email", email);

  if (error) {
    console.error("Failed to update mining source credentials:", error);
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
      console.warn("Skipping source with invalid email:", source.email);
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

  const expiresAt = Number(source.credentials.expiresAt);
  if (Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt <= nowMs) {
    return "OAuth token expired. Reconnect this source.";
  }

  return null;
}
