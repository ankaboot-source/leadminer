import { describe, it, expect } from '@jest/globals';
import buildUidRanges from '../../../src/services/imap/uidRanges';

describe('buildUidRanges', () => {
  it('builds a single range when the window fits in one chunk', () => {
    expect(buildUidRanges(101, 200, 10000)).toEqual(['101:200']);
  });

  it('chunks a large window by chunkSize', () => {
    expect(buildUidRanges(1, 25000, 10000)).toEqual([
      '1:10000',
      '10001:20000',
      '20001:25000'
    ]);
  });

  it('resumes from last_uid+1 (inclusive window starts at last_uid+1)', () => {
    // last_uid = 42 -> [43 .. 42+9]
    expect(buildUidRanges(43, 51, 10000)).toEqual(['43:51']);
  });

  it('returns empty when the window is empty (start > end, e.g. nothing new)', () => {
    expect(buildUidRanges(43, 42, 10000)).toEqual([]);
  });

  it('returns empty for min < 1', () => {
    expect(buildUidRanges(0, 10, 10000)).toEqual([]);
  });
});
