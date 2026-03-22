import { describe, expect, it } from 'vitest';

import { createStartMiningToastPayload } from '@/utils/extras';
import {
  getToastHasLinksDetailMessage,
  hasToastHasLinksButtonAction,
  hasToastHasLinksLink,
} from '@/utils/toast';

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

describe('toast has-links detail helpers', () => {
  it('returns message when detail is a string', () => {
    expect(getToastHasLinksDetailMessage('Simple detail')).toBe(
      'Simple detail',
    );
  });

  it('returns message when detail is an object', () => {
    expect(
      getToastHasLinksDetailMessage({
        message: 'Object detail',
      }),
    ).toBe('Object detail');
  });

  it('returns empty string for unsupported detail values', () => {
    expect(getToastHasLinksDetailMessage(undefined)).toBe('');
    expect(getToastHasLinksDetailMessage(null)).toBe('');
  });

  it('detects object link and button action safely', () => {
    const withAction = {
      message: 'x',
      button: { text: 'Retry', action: () => true },
    };
    const withLink = {
      message: 'x',
      link: { text: 'More', url: 'https://example.com' },
    };

    expect(hasToastHasLinksButtonAction(withAction)).toBe(true);
    expect(hasToastHasLinksButtonAction(withLink)).toBe(false);
    expect(hasToastHasLinksLink(withLink)).toBe(true);
    expect(hasToastHasLinksLink('plain detail')).toBe(false);
  });
});
