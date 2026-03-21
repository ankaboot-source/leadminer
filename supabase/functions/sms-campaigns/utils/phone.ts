export function normalizePhoneNumber(phone: string): string | null {
  const trimmed = phone.trim();

  if (!trimmed) return null;

  let normalized = trimmed;
  normalized = normalized.replace(/\(\s*0\s*\)/g, "");
  if (normalized.startsWith("00")) {
    normalized = `+${normalized.slice(2)}`;
  }

  const cleaned = normalized.replace(/[\s\-\(\)\.]/g, "");
  const e164Match = cleaned.match(/^\+?(\d{10,15})$/);
  if (!e164Match) return null;

  const digits = e164Match[1];
  return `+${digits}`;
}

export function isValidPhoneNumber(phone: string | null): boolean {
  if (!phone) return false;
  return normalizePhoneNumber(phone) !== null;
}
