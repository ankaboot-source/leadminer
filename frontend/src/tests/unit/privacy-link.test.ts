import { describe, expect, it } from 'vitest';
import { resolveDataPrivacyUrl } from '@/utils/privacy-link';

describe('resolveDataPrivacyUrl', () => {
  it('returns null for missing values', () => {
    expect(resolveDataPrivacyUrl(undefined)).toBeNull();
    expect(resolveDataPrivacyUrl(null)).toBeNull();
    expect(resolveDataPrivacyUrl('')).toBeNull();
    expect(resolveDataPrivacyUrl('   ')).toBeNull();
  });

  it('returns trimmed url for non-empty strings', () => {
    expect(resolveDataPrivacyUrl('https://www.leadminer.io/data-privacy')).toBe(
      'https://www.leadminer.io/data-privacy',
    );
    expect(resolveDataPrivacyUrl('  https://example.com/privacy  ')).toBe(
      'https://example.com/privacy',
    );
  });
});
