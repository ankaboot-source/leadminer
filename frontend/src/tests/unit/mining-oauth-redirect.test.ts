import { describe, expect, it } from 'vitest';

import { resolvePostOauthSourceSelection } from '@/utils/mining-oauth-redirect';
import type { MiningSource } from '@/types/mining';

const googleSource: MiningSource = {
  type: 'google',
  email: 'user@example.com',
  passive_mining: false,
};

describe('resolvePostOauthSourceSelection', () => {
  it('stays idle when there is no oauth source query', () => {
    const result = resolvePostOauthSourceSelection({
      querySource: undefined,
      miningSources: [googleSource],
      isLoadingMiningSources: false,
    });

    expect(result).toEqual({
      status: 'idle',
    });
  });

  it('waits while sources are still loading after oauth redirect', () => {
    const result = resolvePostOauthSourceSelection({
      querySource: 'user@example.com',
      miningSources: [],
      isLoadingMiningSources: true,
    });

    expect(result).toEqual({
      status: 'wait',
    });
  });

  it('selects source when it becomes available after loading', () => {
    const result = resolvePostOauthSourceSelection({
      querySource: 'USER@example.com',
      miningSources: [googleSource],
      isLoadingMiningSources: false,
    });

    expect(result).toEqual({
      status: 'select',
      source: googleSource,
    });
  });

  it('falls back to source step when oauth source is missing after load', () => {
    const result = resolvePostOauthSourceSelection({
      querySource: 'missing@example.com',
      miningSources: [googleSource],
      isLoadingMiningSources: false,
    });

    expect(result).toEqual({
      status: 'fallback',
    });
  });
});
