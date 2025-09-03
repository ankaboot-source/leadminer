import messages from '~/i18n/messages.json';
import extras from '~/i18n/messages_extras.json';

// skipcq: SCT-A000
export default defineI18nConfig(() => ({
  locale: 'en',
  fallbackLocale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    en: { ...messages.en, extras: { ...extras.en } },
    fr: { ...messages.fr, extras: { ...extras.fr } },
  },
}));
