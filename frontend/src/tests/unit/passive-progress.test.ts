import { describe, expect, it } from 'vitest';
import {
  applyPassiveProgressEvent,
  EMPTY_PASSIVE_PROGRESS,
} from '@/utils/passiveProgress';

const MINING_ID = 'abc123';

describe('applyPassiveProgressEvent', () => {
  it('tracks fetched, extracted and cleaned per mining id', () => {
    let progress = EMPTY_PASSIVE_PROGRESS;

    progress = applyPassiveProgressEvent(
      `fetched-${MINING_ID}`,
      '12',
      MINING_ID,
      progress,
    )!;
    progress = applyPassiveProgressEvent(
      `extracted-${MINING_ID}`,
      '7',
      MINING_ID,
      progress,
    )!;
    progress = applyPassiveProgressEvent(
      `verifiedContacts-${MINING_ID}`,
      '4',
      MINING_ID,
      progress,
    )!;

    expect(progress).toEqual({ fetched: 12, extracted: 7, cleaned: 4 });
  });

  it('accepts the shared clean-finished event name', () => {
    expect(
      applyPassiveProgressEvent('cleaning-finished', '3', MINING_ID),
    ).toEqual({ fetched: 0, extracted: 0, cleaned: 3 });
  });

  it('ignores events for another mining id', () => {
    expect(
      applyPassiveProgressEvent('fetched-other', '99', MINING_ID),
    ).toBeNull();
  });

  it('ignores non-numeric payloads', () => {
    expect(
      applyPassiveProgressEvent(`fetched-${MINING_ID}`, 'x', MINING_ID),
    ).toBeNull();
  });

  it('does not mutate the previous state', () => {
    const before = { fetched: 1, extracted: 1, cleaned: 1 };
    applyPassiveProgressEvent(`fetched-${MINING_ID}`, '9', MINING_ID, before);
    expect(before).toEqual({ fetched: 1, extracted: 1, cleaned: 1 });
  });
});
