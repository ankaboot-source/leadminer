import { describe, expect, it } from 'vitest';
import { deriveSourceConfig } from '~/utils/miningSourceConfig';

describe('deriveSourceConfig', () => {
  it('returns defaults when config is missing', () => {
    expect(deriveSourceConfig(undefined)).toEqual({
      extract_signatures: false,
      cleaning_enabled: true,
      google_contacts_sync: false,
    });
  });

  it('honors explicit false/true values', () => {
    expect(
      deriveSourceConfig({
        extract_signatures: true,
        cleaning_enabled: false,
        google_contacts_sync: true,
      }),
    ).toEqual({
      extract_signatures: true,
      cleaning_enabled: false,
      google_contacts_sync: true,
    });
  });

  it('treats cleaning_enabled leniently (only explicit false disables)', () => {
    expect(deriveSourceConfig({}).cleaning_enabled).toBe(true);
    expect(
      deriveSourceConfig({ cleaning_enabled: false }).cleaning_enabled,
    ).toBe(false);
  });

  it('falls back to defaults for missing keys on a partial config', () => {
    expect(deriveSourceConfig({ google_contacts_sync: true })).toEqual({
      extract_signatures: false,
      cleaning_enabled: true,
      google_contacts_sync: true,
    });
  });
});
