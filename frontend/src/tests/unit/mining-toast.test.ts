import { describe, expect, it } from 'vitest';

import { createStartMiningToastPayload } from '@/utils/extras';

describe('createStartMiningToastPayload', () => {
  const translations: Record<string, string> = {
    'mining.contacts_got_rights_title': 'Vos contacts ont des droits',
    'mining.contacts_got_rights_detail':
      "Vous avez besoin du consentement ou d'un intérêt légitime pour les contacter.",
    'mining.learn_more_about_rights':
      'En savoir plus sur les droits de vos contacts',
  };

  const t = (key: string) => translations[key] ?? key;

  it('creates a has-links toast payload with message and link', () => {
    const payload = createStartMiningToastPayload({
      t,
      dataPrivacyUrl: 'https://leadminer.io/privacy',
    });

    expect(payload).toEqual({
      severity: 'info',
      group: 'has-links',
      summary: 'Vos contacts ont des droits',
      detail: {
        message:
          "Vous avez besoin du consentement ou d'un intérêt légitime pour les contacter.",
        link: {
          text: 'En savoir plus sur les droits de vos contacts',
          url: 'https://leadminer.io/privacy',
        },
      },
      life: 8000,
    });
  });

  it('always keeps a detail message even when privacy url is missing', () => {
    const payload = createStartMiningToastPayload({
      t,
      dataPrivacyUrl: undefined,
    });

    expect(payload.group).toBe('has-links');
    expect(payload.detail).toEqual({
      message:
        "Vous avez besoin du consentement ou d'un intérêt légitime pour les contacter.",
    });
  });
});
