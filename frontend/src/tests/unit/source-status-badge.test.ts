import { describe, expect, it } from 'vitest';
import { resolveSourceStatusBadge } from '@/utils/sourceStatusBadge';

describe('resolveSourceStatusBadge', () => {
  it('returns mining status badge as info when source is currently mining', () => {
    const badge = resolveSourceStatusBadge({
      isValid: true,
      isActiveMiningSource: true,
      miningStatus: 'running',
    });

    expect(badge.labelKey).toBe('mining_status_running');
    expect(badge.severity).toBe('info');
    expect(badge.icon).toBeUndefined();
  });

  it('returns connected status when source is valid and not currently mining', () => {
    const badge = resolveSourceStatusBadge({
      isValid: true,
      isActiveMiningSource: false,
      miningStatus: undefined,
    });

    expect(badge.labelKey).toBe('connected');
    expect(badge.severity).toBe('success');
  });

  it('returns expired status with warning icon when credentials are invalid', () => {
    const badge = resolveSourceStatusBadge({
      isValid: false,
      isActiveMiningSource: false,
      miningStatus: undefined,
    });

    expect(badge.labelKey).toBe('credential_expired');
    expect(badge.severity).toBe('warn');
    expect(badge.icon).toBe('pi pi-exclamation-triangle');
  });
});
