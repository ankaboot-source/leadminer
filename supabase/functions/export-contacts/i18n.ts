import { initI18n as initBaseI18n, t, getUserLocale } from "../_shared/i18n.ts";
import en from "./i18n/en.json" with { type: "json" };
import fr from "./i18n/fr.json" with { type: "json" };

const resources = {
  en: { translation: en },
  fr: { translation: fr },
};

export async function initI18n(locale: string): Promise<void> {
  await initBaseI18n(locale, resources);
}

export { t, getUserLocale };
