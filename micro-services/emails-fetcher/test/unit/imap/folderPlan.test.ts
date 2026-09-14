import { describe, it, expect, jest } from '@jest/globals';
import {
  planFolderFetch,
  buildSequenceRanges,
  type FolderPlanInput
} from '../../../src/services/imap/folderPlan';

const base: FolderPlanInput = {
  folder: 'INBOX',
  exists: 100,
  uidValidity: 42n,
  uidNext: 101,
  chunkSize: 10000
};

describe('buildSequenceRanges', () => {
  it('uses 1:* for a mailbox that fits in one chunk', () => {
    expect(buildSequenceRanges(100, 10000)).toEqual(['1:*']);
  });

  it('chunks a large mailbox', () => {
    expect(buildSequenceRanges(25000, 10000)).toEqual([
      '1:10000',
      '10001:20000',
      '20001:25000'
    ]);
  });
});

describe('planFolderFetch', () => {
  it('skips an empty folder but keeps a recordable identity (advance policy)', async () => {
    const plan = await planFolderFetch({ ...base, exists: 0 });
    expect(plan).toMatchObject({
      kind: 'skip',
      reason: 'empty',
      ranges: [],
      watermarkPolicy: 'advance'
    });
  });

  it('resumes from the persisted cursor when uidvalidity matches', async () => {
    const searchUids = jest.fn((): Promise<number[]> => Promise.resolve([]));
    const plan = await planFolderFetch({
      ...base,
      resume: { uidvalidity: '42', last_uid: 50 },
      searchUids
    });
    expect(plan).toMatchObject({
      kind: 'uid-resume',
      useUid: true,
      watermarkPolicy: 'advance'
    });
    expect(plan.ranges).toEqual(['51:100']);
    expect(searchUids).not.toHaveBeenCalled();
  });

  it('returns an empty uid-resume window when there is nothing new', async () => {
    const plan = await planFolderFetch({
      ...base,
      uidNext: 51,
      resume: { uidvalidity: '42', last_uid: 50 }
    });
    expect(plan).toMatchObject({ kind: 'uid-resume', ranges: [] });
  });

  it('falls back to a full scan on uidvalidity mismatch (no since)', async () => {
    const plan = await planFolderFetch({
      ...base,
      resume: { uidvalidity: '999', last_uid: 50 }
    });
    expect(plan).toMatchObject({ kind: 'full', useUid: false });
    expect(plan.ranges).toEqual(['1:*']);
  });

  it('uses the since strategy when there is no usable cursor and matches exist', async () => {
    const sinceArgs: Date[] = [];
    const searchUids = jest.fn((since: Date): Promise<number[]> => {
      sinceArgs.push(since);
      return Promise.resolve([10, 20, 30]);
    });
    const plan = await planFolderFetch({
      ...base,
      resume: undefined,
      since: '2026-09-10T00:00:00Z',
      searchUids
    });
    expect(plan).toMatchObject({
      kind: 'since',
      useUid: true,
      watermarkPolicy: 'preserve-or-omit'
    });
    expect(plan.ranges).toEqual(['10:30']);
    expect(searchUids).toHaveBeenCalledTimes(1);
    expect(sinceArgs[0]).toBeInstanceOf(Date);
  });

  it('chunks a large since result list', async () => {
    const uids = Array.from({ length: 5 }, (_, i) => (i + 1) * 10);
    const plan = await planFolderFetch({
      ...base,
      resume: undefined,
      since: '2026-09-10T00:00:00Z',
      chunkSize: 2,
      searchUids: () => Promise.resolve(uids)
    });
    expect(plan.ranges).toEqual(['10:20', '30:40', '50:50']);
  });

  it('skips with no-matches when since returns nothing', async () => {
    const plan = await planFolderFetch({
      ...base,
      resume: undefined,
      since: '2026-09-10T00:00:00Z',
      searchUids: () => Promise.resolve([])
    });
    expect(plan).toMatchObject({
      kind: 'skip',
      reason: 'no-matches',
      watermarkPolicy: 'preserve-or-omit'
    });
  });

  it('degrades a resume cursor to full when uidNext is unavailable and no since is given', async () => {
    const plan = await planFolderFetch({
      ...base,
      uidNext: undefined,
      resume: { uidvalidity: '42', last_uid: 50 }
    });
    expect(plan).toMatchObject({ kind: 'full', useUid: false });
  });

  it('does a full scan when there is no cursor and no since', async () => {
    const plan = await planFolderFetch({ ...base });
    expect(plan).toMatchObject({
      kind: 'full',
      useUid: false,
      watermarkPolicy: 'advance'
    });
    expect(plan.ranges).toEqual(['1:*']);
  });

  it('accepts numeric uidValidity (Number) as well as BigInt', async () => {
    const plan = await planFolderFetch({
      ...base,
      uidValidity: 42,
      resume: { uidvalidity: '42', last_uid: 90 }
    });
    expect(plan).toMatchObject({ kind: 'uid-resume' });
  });
});
