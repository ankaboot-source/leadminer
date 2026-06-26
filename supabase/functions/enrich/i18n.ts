const i18n: Record<string, Record<string, string>> = {};
type Resources = typeof i18n;
let initialized = false;

export async function initI18n(_locale?: string) {
  initialized = true;
}

export function t(key: string, vars?: Record<string, unknown>): string {
  if (!initialized) {
    return key;
  }
  let result = key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      result = result.replace(`{${k}}`, String(v));
    }
  }
  return result;
}

export function getUserLocale(userMetadata: Record<string, unknown>): string {
  return (userMetadata?.locale as string) ?? "en";
}
