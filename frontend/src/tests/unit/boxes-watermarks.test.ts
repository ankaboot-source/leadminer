import { describe, expect, it } from 'vitest';

import type { BoxNode } from '@/utils/boxes';
import {
  buildFolderStatus,
  extractFolderWatermarks,
  markRunFoldersUpToDate,
  refreshBoxWatermarks,
} from '@/utils/watermarks';
import { FolderStatus } from '~/types/enums';

function node(overrides: Partial<BoxNode> = {}): BoxNode {
  return { key: 'INBOX', label: 'INBOX', total: 10, ...overrides };
}

describe('extractFolderWatermarks', () => {
  it('returns empty for missing or legacy configs', () => {
    expect(extractFolderWatermarks()).toEqual({});
    expect(extractFolderWatermarks(null)).toEqual({});
    expect(extractFolderWatermarks({})).toEqual({});
    expect(extractFolderWatermarks({ folders_mined: ['INBOX'] })).toEqual({});
  });

  it('extracts valid watermarks from mining.last.folders', () => {
    expect(
      extractFolderWatermarks({
        mining: {
          last: {
            folders: {
              INBOX: { uidvalidity: '12', last_uid: 7 },
              Sent: { uidvalidity: '9', last_uid: 3 },
            },
          },
        },
      }),
    ).toEqual({
      INBOX: { uidvalidity: '12', last_uid: 7 },
      Sent: { uidvalidity: '9', last_uid: 3 },
    });
  });

  it('drops invalid watermark entries', () => {
    expect(
      extractFolderWatermarks({
        mining: {
          last: {
            folders: {
              INBOX: { uidvalidity: '12', last_uid: 7 },
              Bad: { uidvalidity: '', last_uid: -1 },
              AlsoBad: { uidvalidity: 12, last_uid: 1 },
            },
          },
        },
      }),
    ).toEqual({ INBOX: { uidvalidity: '12', last_uid: 7 } });
  });
});

describe('buildFolderStatus', () => {
  it('is unmined without a watermark', () => {
    expect(buildFolderStatus({})).toEqual({
      status: FolderStatus.Unmined,
      hasNewMessages: false,
    });
  });

  it('is up to date when the cursor matches the watermark', () => {
    expect(
      buildFolderStatus({
        cursor: { uidvalidity: '12', uidnext: 8, high_water_uid: 7 },
        watermark: { uidvalidity: '12', last_uid: 7 },
      }),
    ).toEqual({ status: FolderStatus.UpToDate, hasNewMessages: false });
  });

  it('detects new messages past the watermark', () => {
    expect(
      buildFolderStatus({
        cursor: { uidvalidity: '12', uidnext: 11, high_water_uid: 10 },
        watermark: { uidvalidity: '12', last_uid: 7 },
      }),
    ).toEqual({ status: FolderStatus.NewMessages, hasNewMessages: true });
  });

  it('detects uidvalidity changes and missing metadata', () => {
    expect(
      buildFolderStatus({
        cursor: { uidvalidity: '13', uidnext: 8, high_water_uid: 7 },
        watermark: { uidvalidity: '12', last_uid: 7 },
      }).status,
    ).toBe(FolderStatus.UidvalidityChanged);
    expect(
      buildFolderStatus({
        watermark: { uidvalidity: '12', last_uid: 7 },
      }).status,
    ).toBe(FolderStatus.MetadataUnavailable);
  });
});

describe('refreshBoxWatermarks', () => {
  it('is a no-op for empty trees or watermarks', () => {
    expect(
      refreshBoxWatermarks([], { INBOX: { uidvalidity: '1', last_uid: 1 } }),
    ).toBe(0);
    expect(refreshBoxWatermarks([node()], {})).toBe(0);
    const boxes = [node()];
    expect(refreshBoxWatermarks(boxes, {})).toBe(0);
    expect(boxes[0]?.watermark).toBeUndefined();
  });

  it('sets the watermark and up-to-date status on newly mined folders', () => {
    const boxes = [
      node({
        cursor: { uidvalidity: '12', uidnext: 8, high_water_uid: 7 },
      }),
    ];
    const updated = refreshBoxWatermarks(boxes, {
      INBOX: { uidvalidity: '12', last_uid: 7 },
    });
    expect(updated).toBe(1);
    expect(boxes[0]?.watermark).toEqual({ uidvalidity: '12', last_uid: 7 });
    expect(boxes[0]?.status).toBe(FolderStatus.UpToDate);
    expect(boxes[0]?.has_new_messages).toBe(false);
  });

  it('leaves unlisted folders untouched and recurses into children', () => {
    const child = node({
      key: 'INBOX/Child',
      label: 'Child',
      total: 2,
      cursor: { uidvalidity: '5', uidnext: 4, high_water_uid: 3 },
      status: FolderStatus.Unmined,
    });
    const boxes = [
      node({
        key: 'INBOX',
        label: 'INBOX',
        total: 8,
        cursor: { uidvalidity: '12', uidnext: 8, high_water_uid: 7 },
        children: [child],
      }),
      node({
        key: 'Archive',
        label: 'Archive',
        total: 4,
        status: FolderStatus.Unmined,
      }),
    ];
    const updated = refreshBoxWatermarks(boxes, {
      'INBOX/Child': { uidvalidity: '5', last_uid: 3 },
    });
    expect(updated).toBe(1);
    // Parent without a fresh entry keeps its (absent) watermark.
    expect(boxes[0]?.watermark).toBeUndefined();
    // Counts and labels are preserved.
    expect(boxes[0]?.total).toBe(8);
    expect(boxes[0]?.label).toBe('INBOX');
    // Child is refreshed.
    expect(child.watermark).toEqual({ uidvalidity: '5', last_uid: 3 });
    expect(child.status).toBe(FolderStatus.UpToDate);
    // Unlisted folder untouched.
    expect(boxes[1]?.watermark).toBeUndefined();
    expect(boxes[1]?.status).toBe(FolderStatus.Unmined);
  });

  it('skips the synthetic root key', () => {
    const boxes: BoxNode[] = [
      { key: '', label: 'user@example.com', total: 10, children: [node()] },
    ];
    const updated = refreshBoxWatermarks(boxes, {
      '': { uidvalidity: '1', last_uid: 1 },
      INBOX: { uidvalidity: '12', last_uid: 7 },
    });
    expect(updated).toBe(1);
    expect(boxes[0]?.watermark).toBeUndefined();
  });
});

describe('markRunFoldersUpToDate', () => {
  it('corrects a UIDNEXT gap while preserving an already-correct sibling', () => {
    const starred = node({
      key: '[Gmail]/Starred',
      label: 'Starred',
      total: 29,
      cursor: { uidvalidity: '4', uidnext: 125, high_water_uid: 124 },
    });
    const sibling = node({
      key: 'test-alternateEmail',
      label: 'test-alternateEmail',
      total: 4,
      cursor: { uidvalidity: '38', uidnext: 5, high_water_uid: 4 },
    });
    const boxes: BoxNode[] = [
      {
        key: '',
        label: 'user@example.com',
        total: 33,
        children: [starred, sibling],
      },
    ];
    const watermarks = {
      '': { uidvalidity: '1', last_uid: 1 },
      '[Gmail]/Starred': { uidvalidity: '4', last_uid: 121 },
      'test-alternateEmail': { uidvalidity: '38', last_uid: 4 },
    };

    // The sibling’s predictive UIDNEXT value already equals its watermark, so
    // it refreshes directly to “already mined.” The Starred prediction is a
    // UID-allocation gap above its watermark.
    expect(refreshBoxWatermarks(boxes, watermarks)).toBe(2);
    expect(starred.status).toBe(FolderStatus.NewMessages);
    expect(sibling.status).toBe(FolderStatus.UpToDate);

    expect(markRunFoldersUpToDate(boxes, watermarks, ['[Gmail]/Starred'])).toBe(
      1,
    );
    expect(boxes[0]?.watermark).toBeUndefined();
    expect(starred.watermark).toEqual({ uidvalidity: '4', last_uid: 121 });
    expect(starred.status).toBe(FolderStatus.UpToDate);
    expect(starred.has_new_messages).toBe(false);
    expect(starred.latest_uid).toBe(121);
    expect(sibling.status).toBe(FolderStatus.UpToDate);
  });

  it('does not mark folders missing from the completed run', () => {
    const boxes = [
      node({
        cursor: { uidvalidity: '12', uidnext: 11, high_water_uid: 10 },
        status: FolderStatus.NewMessages,
      }),
    ];
    const watermarks = { INBOX: { uidvalidity: '12', last_uid: 7 } };

    expect(markRunFoldersUpToDate(boxes, watermarks, ['Sent'])).toBe(0);
    expect(boxes[0]?.status).toBe(FolderStatus.NewMessages);
  });

  it('requires a matching UIDVALIDITY before marking completion', () => {
    const boxes = [
      node({
        cursor: { uidvalidity: '99', uidnext: 11, high_water_uid: 10 },
        status: FolderStatus.UidvalidityChanged,
      }),
    ];
    const watermarks = { INBOX: { uidvalidity: '12', last_uid: 7 } };

    expect(markRunFoldersUpToDate(boxes, watermarks, ['INBOX'])).toBe(0);
    expect(boxes[0]?.status).toBe(FolderStatus.UidvalidityChanged);
  });
});
