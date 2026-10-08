import { describe, expect, it } from 'vitest';
import {
  applyPassiveProgressEvent,
  seedPassiveProgress,
  EMPTY_PASSIVE_PROGRESS,
  type PassiveProgress,
} from '@/utils/passiveProgress';

const MINING_ID = 'abc123';

describe('seedPassiveProgress', () => {
  it('reads the snapshot the /sources poll already returned', () => {
    expect(
      seedPassiveProgress({
        fetched: 120,
        extracted: 90,
        createdContacts: 64,
        verifiedContacts: 40,
      }),
      // extracted tracks contacts, so the message count 90 is not used.
    ).toEqual({ fetched: 120, extracted: 64, cleaned: 40 });
  });

  it('falls back to google contacts count when no FetchTask ran', () => {
    expect(
      seedPassiveProgress({
        googleContactsFetchedCount: 75,
        createdContacts: 10,
        verifiedContacts: 0,
      }),
    ).toEqual({ fetched: 75, extracted: 10, cleaned: 0 });
  });

  it('returns empty counters without a snapshot', () => {
    expect(seedPassiveProgress()).toEqual(EMPTY_PASSIVE_PROGRESS);
  });
});

describe('applyPassiveProgressEvent', () => {
  it('tracks fetched, extracted and cleaned per mining id', () => {
    const applied = (event: string, data: string, current: PassiveProgress) => {
      const next = applyPassiveProgressEvent(event, data, MINING_ID, current);
      if (!next) throw new Error(`expected ${event} to apply`);
      return next;
    };

    let progress = EMPTY_PASSIVE_PROGRESS;
    progress = applied(`fetched-${MINING_ID}`, '12', progress);
    progress = applied(`createdContacts-${MINING_ID}`, '7', progress);
    progress = applied(`verifiedContacts-${MINING_ID}`, '4', progress);

    expect(progress).toEqual({ fetched: 12, extracted: 7, cleaned: 4 });
  });

  it('reports created contacts as extracted contacts, never as cleaned', () => {
    const next = applyPassiveProgressEvent(
      `createdContacts-${MINING_ID}`,
      '4600',
      MINING_ID,
    );

    // Regression: createdContacts is the extract-phase contact count. It was
    // once mapped onto cleaned, so an in-flight run reported its contact count
    // under "Nettoyés" while it was still extracting.
    expect(next).toEqual({ fetched: 0, extracted: 4600, cleaned: 0 });
  });

  it('ignores the message-count extracted event', () => {
    // A message count and a contact count are different units; feeding this
    // into the same field would disagree with the seeded snapshot.
    expect(
      applyPassiveProgressEvent(`extracted-${MINING_ID}`, '742', MINING_ID),
    ).toBeNull();
  });

  it('reports verified contacts as cleaned', () => {
    expect(
      applyPassiveProgressEvent(
        `verifiedContacts-${MINING_ID}`,
        '4600',
        MINING_ID,
      ),
    ).toEqual({ fetched: 0, extracted: 0, cleaned: 4600 });
  });

  it('tracks google contacts fetches as scanned', () => {
    expect(
      applyPassiveProgressEvent(
        `googleContactsFetchedCount-${MINING_ID}`,
        '9',
        MINING_ID,
      ),
    ).toEqual({ fetched: 9, extracted: 0, cleaned: 0 });
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

  it('keeps a seeded phase when the next phase reports first', () => {
    // Regression: a zero baseline let the first frame of one phase reset
    // another phase's counters for good.
    const seeded: PassiveProgress = { fetched: 6415, extracted: 0, cleaned: 0 };
    const next = applyPassiveProgressEvent(
      `createdContacts-${MINING_ID}`,
      '452',
      MINING_ID,
      seeded,
    );

    expect(next).toEqual({ fetched: 6415, extracted: 452, cleaned: 0 });
  });
});
