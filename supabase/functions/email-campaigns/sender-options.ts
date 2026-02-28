import { normalizeEmail } from "../_shared/email.ts";

export type MiningSourceCredential = {
  email: string;
  type: string;
  credentials: Record<string, unknown>;
};

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
