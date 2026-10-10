import { describe, expect, it } from 'vitest';

import { resolveMiningActionsDisabled } from '@/utils/mining-table-actions';

const base = {
  miningActive: false,
  contactsCount: 10,
  selectedCount: 3,
  connecting: false,
};

describe('resolveMiningActionsDisabled', () => {
  it('enables actions on a settled, populated list', () => {
    expect(resolveMiningActionsDisabled(base)).toBe(false);
  });

  it('disables every action while a mining run is in progress', () => {
    expect(resolveMiningActionsDisabled({ ...base, miningActive: true })).toBe(
      true,
    );
  });

  it('disables while connecting, before contacts stream in', () => {
    expect(resolveMiningActionsDisabled({ ...base, connecting: true })).toBe(
      true,
    );
  });

  it('disables when there are no contacts', () => {
    expect(resolveMiningActionsDisabled({ ...base, contactsCount: 0 })).toBe(
      true,
    );
  });

  it('disables when nothing is selected', () => {
    expect(resolveMiningActionsDisabled({ ...base, selectedCount: 0 })).toBe(
      true,
    );
  });

  it('keeps actions disabled mid-mining even with a full selection', () => {
    // The regression: a populated table mid-run must still be locked, since
    // the list is only partially mined.
    expect(
      resolveMiningActionsDisabled({
        miningActive: true,
        contactsCount: 500,
        selectedCount: 500,
        connecting: false,
      }),
    ).toBe(true);
  });
});
