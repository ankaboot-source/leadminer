import { describe, expect, it } from 'vitest';

import { computeExtractionProgress } from '@/utils/mining-progress';

const base = {
  extractedEmails: 0,
  scannedEmails: 0,
  totalEmails: 0,
  fetchingFinished: true,
  canceled: false,
  googleContactsSync: false,
  googleContactsFetchedCount: 0,
  googleContactsTotal: 0,
};

describe('computeExtractionProgress', () => {
  it('uses scannedEmails once fetching finished', () => {
    expect(
      computeExtractionProgress({
        ...base,
        extractedEmails: 5,
        scannedEmails: 10,
        totalEmails: 10,
      }),
    ).toBe(0.5);
  });

  it('uses totalEmails before fetching finished', () => {
    expect(
      computeExtractionProgress({
        ...base,
        extractedEmails: 3,
        scannedEmails: 0,
        totalEmails: 10,
        fetchingFinished: false,
      }),
    ).toBe(0.3);
  });

  it('uses totalEmails when canceled', () => {
    expect(
      computeExtractionProgress({
        ...base,
        extractedEmails: 4,
        scannedEmails: 8,
        totalEmails: 10,
        canceled: true,
      }),
    ).toBe(0.4);
  });

  it('caps at 100% when google contacts inflate the extraction counter (145% bug)', () => {
    expect(
      computeExtractionProgress({
        ...base,
        extractedEmails: 145,
        scannedEmails: 100,
        totalEmails: 100,
        googleContactsSync: true,
        googleContactsFetchedCount: 45,
        googleContactsTotal: 45,
      }),
    ).toBe(1);
  });

  it('climbs below 100% while google contacts are still being fetched', () => {
    const result = computeExtractionProgress({
      ...base,
      extractedEmails: 120,
      scannedEmails: 100,
      totalEmails: 100,
      googleContactsSync: true,
      googleContactsFetchedCount: 30,
      googleContactsTotal: 0,
    });
    expect(result).toBeCloseTo(120 / 130, 5);
    expect(result).toBeLessThanOrEqual(1);
  });

  it('returns 0 when the denominator is 0', () => {
    expect(computeExtractionProgress(base)).toBe(0);
  });
});
