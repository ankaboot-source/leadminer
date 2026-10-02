import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const messagesPath = path.resolve(
  __dirname,
  '../../..',
  'src/i18n/messages.json',
);
const extrasPath = path.resolve(
  __dirname,
  '../../..',
  'src/i18n/messages_extras.json',
);

function collectMessages(value: unknown, trail: string[] = []): string[] {
  if (typeof value === 'string') {
    return [`${[...trail, value].join('.')} => ${value}`];
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) =>
      collectMessages(child, [...trail, key]),
    );
  }
  return [];
}

const PADDED_PARENTHESES = /\(\s+\S|\S\s+\)/;

describe('i18n message copy', () => {
  it('never pads the inside of parentheses', () => {
    const offenders = [messagesPath, extrasPath].flatMap((file) =>
      collectMessages(JSON.parse(fs.readFileSync(file, 'utf-8'))).filter(
        (entry) => PADDED_PARENTHESES.test(entry.split(' => ')[1] ?? ''),
      ),
    );

    expect(offenders).toEqual([]);
  });

  it('keeps the mining settings hints parenthesized in both locales', () => {
    const messages = JSON.parse(fs.readFileSync(messagesPath, 'utf-8'));

    for (const locale of ['en', 'fr'] as const) {
      expect(messages[locale].mining.extract_signatures_sub).toMatch(
        /^\([^ ].*[^ ]\)$/,
      );
      expect(messages[locale].mining.cleaning_enabled_sub).toMatch(
        /^\([^ ].*[^ ]\)$/,
      );
    }
  });
});
