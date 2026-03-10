import messages from "./i18n.json" with { type: "json" };

type Locale = "en" | "fr";

type I18nMessages = typeof messages;

type PluralValue = { count: number; singular: string; plural: string };

function parsePlural(text: string, count: number): string {
  // Parse "singular | plural" format
  const parts = text.split(/\s*\|\s*/);
  if (parts.length === 1) return text;

  // If it contains "{available}" or "{total}", it's a template with plural forms
  // Format: "You have {available} credit | You have {available} credits"
  const singularForm = parts[0]?.trim() || "";
  const pluralForm = parts[1]?.trim() || singularForm;

  return count === 1 ? singularForm : pluralForm;
}

/**
 * Simple template interpolator: replaces {var} with provided values
 */
export function interpolate(
  template: string,
  vars: Record<string, string | number> = {},
): string {
  return template.replace(/{(\w+)}/g, (_, key) => String(vars[key] ?? ""));
}

function getNestedValue(obj: unknown, keys: string[]): unknown {
  let current = obj;
  for (const k of keys) {
    if (current && typeof current === "object" && k in current) {
      current = (current as Record<string, unknown>)[k];
    } else {
      return undefined;
    }
  }
  return current;
}

export function t(
  locale: Locale,
  key: string,
  values: Record<string, number | string> = {},
): string {
  const localeMessages = messages[locale] || messages.en;
  const keys = key.split(".");

  // Try locale messages first
  let current = getNestedValue(localeMessages, keys);

  // Fallback to English if not found
  if (current === undefined) {
    current = getNestedValue(messages.en, keys);
  }

  if (typeof current !== "string") return key;

  // Handle plural forms using the first number value
  let result = current;
  const countValue = Object.values(values).find((v) => typeof v === "number");
  if (countValue !== undefined) {
    result = parsePlural(result, countValue);
  }

  return interpolate(result, values);
}

export function getUserLocale(userMetadata: Record<string, unknown>): Locale {
  const emailTemplate = userMetadata?.EmailTemplate as
    | Record<string, string>
    | undefined;
  const language = emailTemplate?.language;

  if (language === "fr") return "fr";
  return "en"; // Default to English
}
