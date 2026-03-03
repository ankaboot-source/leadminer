import { normalizeEmail } from "../_shared/email.ts";
import { createLogger } from "../_shared/logger.ts";

const logger = createLogger("sender-options");

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
