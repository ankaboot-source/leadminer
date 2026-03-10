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

function interpolate(
  text: string,
  values: Record<string, number | string>,
): string {
  return text.replace(/\{(\w+)\}/g, (match, key) => {
    const value = values[key];
    if (value === undefined) return match;
    return String(value);
  });
}

export function t(
  locale: Locale,
  key: string,
  values: Record<string, number | string> = {},
): string {
  const localeMessages = messages[locale] || messages.en;
  const keys = key.split(".");

  let current: unknown = localeMessages;
  for (const k of keys) {
    if (current && typeof current === "object" && k in current) {
      current = (current as Record<string, unknown>)[k];
    } else {
      // Fallback to English
      current = messages.en;
      for (const fallbackKey of keys) {
        if (current && typeof current === "object" && fallbackKey in current) {
          current = (current as Record<string, unknown>)[fallbackKey];
        } else {
          return key; // Return key if translation not found
        }
      }
    }
  }

  if (typeof current !== "string") return key;

  // Handle plural forms if values contain count-related keys
  let result = current;
  if ("available" in values) {
    result = parsePlural(result, Number(values.available));
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
