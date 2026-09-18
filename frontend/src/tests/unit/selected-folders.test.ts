import { describe, expect, it } from 'vitest';

import {
  folderDisplayName,
  getSelectedFolderKeys,
  hasSelectedFolders,
} from '@/utils/selected-folders';

describe('getSelectedFolderKeys', () => {
  it('returns checked, non-excluded, non-root keys', () => {
    const selected = {
      INBOX: { checked: true },
      Sent: { checked: false },
      'Archive/Old': { checked: true },
      '': { checked: true },
    };
    expect(getSelectedFolderKeys(selected)).toEqual(['INBOX', 'Archive/Old']);
  });

  it('drops excluded folders', () => {
    const selected = { INBOX: { checked: true }, Sent: { checked: true } };
    expect(getSelectedFolderKeys(selected, new Set(['Sent']))).toEqual([
      'INBOX',
    ]);
  });

  it('handles null/undefined selectedBoxes', () => {
    expect(getSelectedFolderKeys()).toEqual([]);
    expect(getSelectedFolderKeys(null, new Set())).toEqual([]);
  });

  it('ignores entries without checked === true', () => {
    const selected = {
      INBOX: { partialChecked: true },
      Sent: {},
      Drafts: true,
    };
    expect(getSelectedFolderKeys(selected)).toEqual([]);
  });
});

describe('hasSelectedFolders', () => {
  it('is true only when a selectable folder is checked', () => {
    expect(hasSelectedFolders({ INBOX: { checked: true } })).toBe(true);
    expect(hasSelectedFolders({ Sent: { checked: false } })).toBe(false);
    expect(
      hasSelectedFolders({ Sent: { checked: true } }, new Set(['Sent'])),
    ).toBe(false);
    expect(hasSelectedFolders()).toBe(false);
  });
});

describe('folderDisplayName', () => {
  it('maps INBOX case-insensitively to the provided label', () => {
    expect(folderDisplayName('INBOX', 'Inbox')).toBe('Inbox');
    expect(folderDisplayName('inbox', 'Inbox')).toBe('Inbox');
  });

  it('prefers the fallback for non-INBOX folders', () => {
    expect(folderDisplayName('Archive/Old', 'Inbox', 'Old Label')).toBe(
      'Old Label',
    );
  });

  it('falls back to the last path segment', () => {
    expect(folderDisplayName('Archive/2024', 'Inbox')).toBe('2024');
  });
});
