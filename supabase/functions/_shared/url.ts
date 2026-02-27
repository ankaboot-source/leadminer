function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export function resolvePublicBaseUrl(
  explicitPublicUrl?: string,
  fallbackUrl?: string,
): string {
  const candidate = (explicitPublicUrl || fallbackUrl || "").trim();
  if (!candidate) {
    throw new Error("Missing public base URL");
  }
  return normalizeBaseUrl(candidate);
}
