import { describe, expect, it } from 'vitest';
import {
  buildSelectedResumeCursor,
  resolveMiningFolderState,
} from '~/utils/miningFolderState';

const cursor = (uidvalidity: string, high_water_uid: number) => ({
  uidvalidity,
  uidnext: high_water_uid + 1,
  high_water_uid,
});

const watermark = (uidvalidity: string, last_uid: number) => ({
  uidvalidity,
  last_uid,
  updated_at: '2026-09-04T00:00:00.000Z',
});

describe('resolveMiningFolderState', () => {
  it('marks an unseen folder as unmined', () => {
    expect(resolveMiningFolderState(cursor('1', 10))).toEqual({
      state: 'unmined',
      hasNewMessages: false,
      requiresFullScan: false,
    });
  });

  it('uses uidnext - 1 as a high-water bound for new-message detection', () => {
    expect(
      resolveMiningFolderState(cursor('1', 11), watermark('1', 10)),
    ).toEqual({
      state: 'new_messages',
      hasNewMessages: true,
      requiresFullScan: false,
    });
    expect(
      resolveMiningFolderState(cursor('1', 10), watermark('1', 10)).state,
    ).toBe('up_to_date');
  });

  it('requires a full scan when UIDVALIDITY changes', () => {
    expect(
      resolveMiningFolderState(cursor('2', 11), watermark('1', 10)),
    ).toEqual({
      state: 'uidvalidity_changed',
      hasNewMessages: false,
      requiresFullScan: true,
    });
  });

  it('does not infer new messages when mailbox metadata is unavailable', () => {
    expect(resolveMiningFolderState(undefined, watermark('1', 10)).state).toBe(
      'metadata_unavailable',
    );
  });
});

describe('buildSelectedResumeCursor', () => {
  it('intersects selected folders with matching persisted watermarks', () => {
    expect(
      buildSelectedResumeCursor(
        ['INBOX', 'Sent', 'Archive'],
        {
          INBOX: cursor('1', 20),
          Sent: cursor('2', 30),
          Archive: cursor('1', 3),
        },
        {
          INBOX: watermark('1', 10),
          Sent: watermark('old', 20),
          Archive: watermark('1', 3),
        },
      ),
    ).toEqual({
      folders: {
        INBOX: { uidvalidity: '1', last_uid: 10 },
        Archive: { uidvalidity: '1', last_uid: 3 },
      },
    });
  });

  it('omits resumeFrom when no selected folder can safely resume', () => {
    expect(
      buildSelectedResumeCursor(
        ['Sent'],
        { Sent: cursor('2', 30) },
        { Sent: watermark('1', 20) },
      ),
    ).toBeUndefined();
  });
});
