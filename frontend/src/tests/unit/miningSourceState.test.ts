import { describe, expect, it } from 'vitest';
import {
  deriveSourceConfig,
  deriveSourceState,
  readSourceConfig,
} from '~/utils/miningSourceConfig';
import type { MiningSource } from '~/types/mining';

describe('deriveSourceConfig', () => {
  it('returns defaults when config is missing', () => {
    expect(deriveSourceConfig()).toEqual({
      extract_signatures: false,
      cleaning_enabled: true,
      google_contacts_sync: false,
    });
  });

  it('defaults from namespaced flags', () => {
    expect(
      deriveSourceConfig({
        flags: { extract_signatures: true, cleaning_enabled: false },
      }),
    ).toEqual({
      extract_signatures: true,
      cleaning_enabled: false,
      google_contacts_sync: false,
    });
  });

  it('folds legacy flat flag keys into namespaced flags', () => {
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
      deriveSourceConfig({ flags: { cleaning_enabled: false } })
        .cleaning_enabled,
    ).toBe(false);
  });
});

function source(overrides: Partial<MiningSource> = {}): MiningSource {
  return { type: 'google', email: 'a@b.com', ...overrides };
}

describe('readSourceConfig', () => {
  it('passes through a namespaced V1 config', () => {
    const config = {
      version: 1 as const,
      flags: { cleaning_enabled: false },
      health: { state: 'error' as const, last_error: ['boom'] },
    };
    expect(readSourceConfig(source({ config }))).toEqual(config);
  });

  it('normalizes legacy keys into namespaced shape', () => {
    const normalized = readSourceConfig(
      source({
        config: {
          needs_reauth: true,
          status: 'failed',
          last_run: '2026-09-01T00:00:00Z',
          errors: ['oops'],
          folders_mined: ['INBOX'],
          cleaning_enabled: false,
        },
      }),
    );
    expect(normalized.health).toEqual({
      state: 'needs_reauth',
      last_run_at: '2026-09-01T00:00:00Z',
      last_error: ['oops'],
    });
    expect(normalized.flags).toEqual({ cleaning_enabled: false });
    expect(normalized.mining?.last).toEqual({ folders_mined: ['INBOX'] });
  });

  it('accepts a raw config object directly (source-less read)', () => {
    expect(readSourceConfig({ health: { state: 'error' } }).health).toEqual({
      state: 'error',
    });
  });
});

describe('deriveSourceState', () => {
  it('returns active + empty watermark for a fresh source', () => {
    const state = deriveSourceState(source());
    expect(state.state).toBe('active');
    expect(state.minableFolders).toEqual([]);
    expect(state.watermark).toBeUndefined();
  });

  it('reads needs_reauth from health', () => {
    expect(
      deriveSourceState(
        source({ config: { health: { state: 'needs_reauth' } } }),
      ).state,
    ).toBe('needs_reauth');
  });

  it('folds legacy needs_reauth into state', () => {
    expect(
      deriveSourceState(source({ config: { needs_reauth: true } })).state,
    ).toBe('needs_reauth');
  });

  it('surfaces lastError and lastRunAt', () => {
    const state = deriveSourceState(
      source({
        config: {
          health: {
            state: 'error',
            last_error: ['e1'],
            last_run_at: '2026-01-01T00:00:00Z',
          },
        },
      }),
    );
    expect(state.lastError).toEqual(['e1']);
    expect(state.lastRunAt).toBe('2026-01-01T00:00:00Z');
  });

  it('derives minable folders + resume watermark from mining.last.folders', () => {
    const state = deriveSourceState(
      source({
        config: {
          mining: {
            last: {
              folders: {
                INBOX: {
                  uidvalidity: '12',
                  last_uid: 7,
                  updated_at: '2026-01-01T00:00:00Z',
                },
                Sent: {
                  uidvalidity: '9',
                  last_uid: 3,
                  updated_at: '2026-01-01T00:00:00Z',
                },
              },
            },
          },
        },
      }),
    );
    expect(state.minableFolders).toEqual(['INBOX', 'Sent']);
    expect(state.watermark?.INBOX).toEqual({ uidvalidity: '12', last_uid: 7 });
    expect(state.watermark?.Sent).toEqual({ uidvalidity: '9', last_uid: 3 });
  });
});
