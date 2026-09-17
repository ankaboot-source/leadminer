import { describe, expect, it } from 'vitest';
import {
  buildPassiveFolderList,
  diffUnregisteredFolders,
} from '@/utils/passive-mining-folders';

describe('diffUnregisteredFolders', () => {
  it('returns mined folders missing from registration, order-stable, deduped', () => {
    expect(
      diffUnregisteredFolders(['INBOX', 'INBOX', 'Sent', 'Drafts'], ['INBOX']),
    ).toEqual(['Sent', 'Drafts']);
  });

  it('returns [] when everything is registered or nothing was mined', () => {
    expect(diffUnregisteredFolders(['INBOX'], ['INBOX'])).toEqual([]);
    expect(diffUnregisteredFolders([], ['INBOX'])).toEqual([]);
  });
});

describe('buildPassiveFolderList', () => {
  const labelFor = (key: string) =>
    key.toUpperCase() === 'INBOX' ? 'Inbox' : (key.split('/').pop() ?? key);

  it('marks registered checked, new checked+badged', () => {
    expect(
      buildPassiveFolderList({
        mined: ['INBOX', 'Sent'],
        registered: ['INBOX'],
        available: ['INBOX', 'Sent'],
        labelFor,
      }),
    ).toEqual([
      {
        key: 'INBOX',
        label: 'Inbox',
        checked: true,
        isNew: false,
        unavailable: false,
      },
      {
        key: 'Sent',
        label: 'Sent',
        checked: true,
        isNew: true,
        unavailable: false,
      },
    ]);
  });

  it('prunes unavailable folders unchecked', () => {
    expect(
      buildPassiveFolderList({
        mined: ['INBOX'],
        registered: ['INBOX', 'Old'],
        available: ['INBOX'],
        labelFor,
      }),
    ).toEqual([
      {
        key: 'INBOX',
        label: 'Inbox',
        checked: true,
        isNew: false,
        unavailable: false,
      },
      {
        key: 'Old',
        label: 'Old',
        checked: false,
        isNew: false,
        unavailable: true,
      },
    ]);
  });
});
