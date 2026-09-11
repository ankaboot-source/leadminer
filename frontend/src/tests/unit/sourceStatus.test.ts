import { describe, it, expect } from 'vitest';
import { deriveSourceStatus } from '~/utils/sourceStatus';
import type { MiningSource } from '~/types/mining';

function src(overrides: Partial<MiningSource> = {}): MiningSource {
  return {
    id: 'id-1',
    type: 'imap',
    email: 'miner@example.com',
    config: { version: 1, health: { state: 'active' } },
    ...overrides,
  };
}

describe('deriveSourceStatus', () => {
  it('shows a reconnect badge for needs_reauth', () => {
    const status = deriveSourceStatus(
      src({ config: { version: 1, health: { state: 'needs_reauth' } } }),
    );
    expect(status.health).toBe('needs_reauth');
    expect(status.badge.labelKey).toBe('credential_expired');
    expect(status.badge.severity).toBe('danger');
    expect(status.showReconnect).toBe(true);
  });

  it('folds the legacy needs_reauth key', () => {
    const status = deriveSourceStatus(
      src({ config: { needs_reauth: true } as never }),
    );
    expect(status.health).toBe('needs_reauth');
    expect(status.showReconnect).toBe(true);
  });

  it('shows a failure badge for error without a reconnect action', () => {
    const status = deriveSourceStatus(
      src({ config: { version: 1, health: { state: 'error' } } }),
    );
    expect(status.badge.labelKey).toBe('mining_status_failed');
    expect(status.badge.severity).toBe('danger');
    expect(status.showReconnect).toBe(false);
  });

  it('shows connected for a healthy source (no misleading credential badge)', () => {
    const status = deriveSourceStatus(src(), {});
    expect(status.health).toBe('active');
    expect(status.badge.labelKey).toBe('connected');
    expect(status.badge.severity).toBe('success');
    expect(status.showReconnect).toBe(false);
  });

  it('prioritises the active mining run badge', () => {
    const status = deriveSourceStatus(src(), {
      email: 'miner@example.com',
      status: 'running',
    });
    expect(status.isActiveMiningSource).toBe(true);
    expect(status.badge.labelKey).toBe('mining_status_running');
    expect(status.badge.severity).toBe('info');
  });

  it('maps the done and canceled run statuses', () => {
    expect(
      deriveSourceStatus(src(), { email: 'miner@example.com', status: 'done' })
        .badge.labelKey,
    ).toBe('mining_status_done');
    expect(
      deriveSourceStatus(src(), {
        email: 'miner@example.com',
        status: 'canceled',
      }).badge.labelKey,
    ).toBe('mining_status_canceled');
  });

  it('does not treat a different source as actively mining', () => {
    const status = deriveSourceStatus(src(), {
      email: 'other@example.com',
      status: 'running',
    });
    expect(status.isActiveMiningSource).toBe(false);
    expect(status.badge.labelKey).toBe('connected');
  });

  it('needs_reauth wins over an active run', () => {
    const status = deriveSourceStatus(
      src({ config: { version: 1, health: { state: 'needs_reauth' } } }),
      { email: 'miner@example.com', status: 'running' },
    );
    expect(status.badge.labelKey).toBe('credential_expired');
    expect(status.showReconnect).toBe(true);
  });
});
