import i18next from "npm:i18next@23.11.5";

let i18nInstance: typeof i18next | null = null;

// deno-lint-ignore no-explicit-any
type Resource = Record<string, any>;

export async function initI18n(
  locale: string,
  resources: Record<string, unknown>,
): Promise<typeof i18next> {
  if (!i18nInstance) {
    i18nInstance = i18next.createInstance();
    // deno-lint-ignore no-explicit-any
    await i18nInstance.init(resources as any);
  }
  return i18nInstance;
}

export function t(
  key: string,
  options?: Record<string, string | number>,
): string {
  if (!i18nInstance) {
    return key;
  }
  return i18nInstance.t(key, options);
}

export function getUserLocale(userMetadata: Record<string, unknown>): string {
  const emailTemplate = userMetadata?.EmailTemplate as
    | Record<string, string>
    | undefined;
  const language = emailTemplate?.language;

  if (language === "fr") return "fr";
  return "en";
}
