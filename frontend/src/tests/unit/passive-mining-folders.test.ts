import { describe, expect, it } from 'vitest';
import { diffUnregisteredFolders } from '@/utils/passive-mining-folders';

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
