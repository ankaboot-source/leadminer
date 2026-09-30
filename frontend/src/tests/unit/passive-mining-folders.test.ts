import { describe, expect, it } from 'vitest';
import {
  diffUnregisteredFolders,
  resolvePassiveMiningPrompt,
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

describe('resolvePassiveMiningPrompt', () => {
  it('prompts first-time when passive is off', () => {
    expect(
      resolvePassiveMiningPrompt({
        passiveEnabled: false,
        minedFolders: ['INBOX'],
        registeredFolders: [],
      }),
    ).toBe('first-time');
  });

  it('prompts update when a mined folder is not registered', () => {
    expect(
      resolvePassiveMiningPrompt({
        passiveEnabled: true,
        minedFolders: ['INBOX', 'New'],
        registeredFolders: ['INBOX'],
      }),
    ).toBe('update');
  });

  it('stays quiet when every mined folder is registered', () => {
    expect(
      resolvePassiveMiningPrompt({
        passiveEnabled: true,
        minedFolders: ['INBOX'],
        registeredFolders: ['INBOX'],
      }),
    ).toBeNull();
  });
});
