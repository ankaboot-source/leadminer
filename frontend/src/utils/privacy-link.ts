export function resolveDataPrivacyUrl(url: unknown): string | null {
  if (typeof url !== 'string') {
    return null;
  }

  const trimmed = url.trim();
  return trimmed.length ? trimmed : null;
}
