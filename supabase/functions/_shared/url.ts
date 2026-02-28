function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

type EnvReader = (key: string) => string | undefined;

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

export function resolveCampaignBaseUrlFromEnv(readEnv: EnvReader): string {
  return resolvePublicBaseUrl(
    readEnv("SUPABASE_PROJECT_URL"),
    readEnv("SUPABASE_URL"),
  );
}
