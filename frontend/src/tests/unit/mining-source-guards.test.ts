import { describe, expect, it } from 'vitest';

import { requiresActiveMiningSource } from '@/utils/mining-source-guards';

describe('requiresActiveMiningSource', () => {
  it('requires an active source only for email mining', () => {
    expect(requiresActiveMiningSource('email')).toBe(true);
    expect(requiresActiveMiningSource('file')).toBe(false);
    expect(requiresActiveMiningSource('pst')).toBe(false);
  });
});
