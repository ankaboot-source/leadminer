import { describe, expect, it } from 'vitest';

import { buildFolderStatus } from '@/utils/watermarks';
import { FolderStatus } from '~/types/enums';

/**
 * Locks the folder sync-state decision table shared with the backend
 * (`imapTreeHelpers.buildFolderStatus`). This is a cross-runtime contract:
 * folder status is computed server-side for the tree and re-derived in the
 * frontend after a config refresh, so both must agree. Inline (no shared file
 * is shipped across runtimes), mirroring `enums.contract.test.ts`.
 */
describe('folder status contract', () => {
  const cursor = (
    uidvalidity: string | null,
    high_water_uid: number | null,
  ) => ({ uidvalidity, uidnext: high_water_uid, high_water_uid });

  it.each([
    {
      name: 'no watermark => unmined',
      watermark: undefined,
      cursor: cursor('1', 5),
      status: FolderStatus.Unmined,
      hasNew: false,
    },
    {
      name: 'empty uidvalidity => uidvalidity changed',
      watermark: { uidvalidity: '', last_uid: 3 },
      cursor: cursor('1', 5),
      status: FolderStatus.UidvalidityChanged,
      hasNew: false,
    },
    {
      name: 'null cursor uidvalidity => metadata unavailable',
      watermark: { uidvalidity: '1', last_uid: 3 },
      cursor: cursor(null, 5),
      status: FolderStatus.MetadataUnavailable,
      hasNew: false,
    },
    {
      name: 'null high water uid => metadata unavailable',
      watermark: { uidvalidity: '1', last_uid: 3 },
      cursor: cursor('1', null),
      status: FolderStatus.MetadataUnavailable,
      hasNew: false,
    },
    {
      name: 'uidvalidity mismatch => uidvalidity changed',
      watermark: { uidvalidity: '1', last_uid: 3 },
      cursor: cursor('2', 5),
      status: FolderStatus.UidvalidityChanged,
      hasNew: false,
    },
    {
      name: 'cursor ahead => new messages',
      watermark: { uidvalidity: '1', last_uid: 3 },
      cursor: cursor('1', 5),
      status: FolderStatus.NewMessages,
      hasNew: true,
    },
    {
      name: 'cursor equal => up to date',
      watermark: { uidvalidity: '1', last_uid: 5 },
      cursor: cursor('1', 5),
      status: FolderStatus.UpToDate,
      hasNew: false,
    },
  ])('$name', ({ watermark, cursor: c, status, hasNew }) => {
    expect(buildFolderStatus({ cursor: c, watermark })).toEqual({
      status,
      hasNewMessages: hasNew,
    });
  });
});
