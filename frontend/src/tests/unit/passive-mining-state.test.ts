import { describe, expect, it } from 'vitest';

import { normalizePassiveMinings } from '@/utils/passiveMiningState';
import type { MiningTaskGroup } from '~/types/mining';

const group = (miningId: string) =>
  ({ task: { miningId } }) as unknown as MiningTaskGroup;

describe('normalizePassiveMinings', () => {
  it('reports no runs when the endpoint answers 204', () => {
    // Regression: `GET /imap/mine/:userId/` returns 204 No Content when
    // nothing is running, so the response arrives empty. Treating that as
    // "keep what we had" left the finished run on screen and the /sources
    // chip claimed it was still mining.
    expect(normalizePassiveMinings()).toEqual([]);
    expect(normalizePassiveMinings(null)).toEqual([]);
  });

  it('reports no runs for an empty or missing passive array', () => {
    expect(normalizePassiveMinings({ passive: [] })).toEqual([]);
    expect(normalizePassiveMinings({})).toEqual([]);
  });

  it('keeps the runs the poll reported', () => {
    const first = group('run-1');
    const second = group('run-2');

    expect(normalizePassiveMinings({ passive: [first, second] })).toEqual([
      first,
      second,
    ]);
  });

  it('drops holes the poll can return', () => {
    const running = group('run-1');

    expect(
      normalizePassiveMinings({
        passive: [running, undefined, null] as Array<MiningTaskGroup>,
      }),
    ).toEqual([running]);
  });
});
