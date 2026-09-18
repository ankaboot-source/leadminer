import { describe, expect, it } from 'vitest';

import { FolderStatus, MiningRunMode } from '~/types/enums';
import { resolveMiningIntent, resolveRunMode } from '@/utils/mining-intent';
import type { BoxNode } from '@/utils/boxes';

function node(
  key: string,
  status?: FolderStatus,
  watermark?: { uidvalidity: string; last_uid: number },
): BoxNode {
  return {
    key,
    label: key,
    total: 0,
    status,
    ...(watermark ? { watermark } : {}),
  };
}

describe('resolveRunMode', () => {
  it('is incremental when any node has a watermark', () => {
    expect(
      resolveRunMode([
        node('A'),
        node('B', undefined, { uidvalidity: '1', last_uid: 1 }),
      ]),
    ).toBe(MiningRunMode.Incremental);
  });

  it('is full with no watermarks', () => {
    expect(resolveRunMode([node('A'), node('B')])).toBe(MiningRunMode.Full);
  });
});

describe('resolveMiningIntent', () => {
  it('resumes when any folder has new messages', () => {
    expect(
      resolveMiningIntent([
        node('[Gmail]/Starred', FolderStatus.NewMessages, {
          uidvalidity: '4',
          last_uid: 121,
        }),
        node('test-alternateEmail', FolderStatus.UpToDate, {
          uidvalidity: '38',
          last_uid: 4,
        }),
      ]),
    ).toEqual({ kind: 'resume' });
  });

  it('is mixed when some but not all folders are up to date', () => {
    const intent = resolveMiningIntent([
      node('INBOX', FolderStatus.UpToDate, { uidvalidity: '1', last_uid: 2 }),
      node('New', FolderStatus.Unmined),
    ]);
    expect(intent).toEqual({
      kind: 'mixed',
      folders: [
        { key: 'INBOX', label: 'INBOX', status: 'up_to_date' },
        { key: 'New', label: 'New', status: 'new' },
      ],
    });
  });

  it('is all-mined when every folder is up to date', () => {
    expect(
      resolveMiningIntent([
        node('INBOX', FolderStatus.UpToDate, { uidvalidity: '1', last_uid: 2 }),
        node('Sent', FolderStatus.UpToDate, { uidvalidity: '1', last_uid: 3 }),
      ]),
    ).toEqual({ kind: 'all-mined' });
  });

  it('runs directly for brand-new selections', () => {
    expect(resolveMiningIntent([node('INBOX', FolderStatus.Unmined)])).toEqual({
      kind: 'run',
      mode: MiningRunMode.Full,
    });
  });

  it('runs incrementally for unmined-status nodes that still carry a watermark', () => {
    expect(
      resolveMiningIntent([
        node('INBOX', FolderStatus.MetadataUnavailable, {
          uidvalidity: '1',
          last_uid: 9,
        }),
      ]),
    ).toEqual({ kind: 'run', mode: MiningRunMode.Incremental });
  });

  it('treats an empty selection as a direct run', () => {
    expect(resolveMiningIntent([])).toEqual({
      kind: 'run',
      mode: MiningRunMode.Full,
    });
  });
});
