import { describe, expect, it } from 'vitest';

import type { Contact } from '@/types/contact';
import {
  resolveContactsLoadingStrategy,
  resolveMiningTableRows,
} from '@/utils/mining-table';

describe('resolveMiningTableRows', () => {
  it('returns an empty array when contacts are undefined', () => {
    const result = resolveMiningTableRows({
      hardFilter: false,
      contacts: undefined,
      jobDetailsContacts: [],
    });

    expect(result).toEqual([]);
  });

  it('uses job details rows when hard filter is enabled', () => {
    const contacts = [{ email: 'a@example.com' } as Contact];
    const jobDetailsContacts = [{ email: 'b@example.com' } as Contact];

    const result = resolveMiningTableRows({
      hardFilter: true,
      contacts,
      jobDetailsContacts,
    });

    expect(result).toEqual(jobDetailsContacts);
  });
});

describe('resolveContactsLoadingStrategy', () => {
  it('loads immediately when table is already visible', () => {
    const result = resolveContactsLoadingStrategy({ showTable: true });

    expect(result).toBe('immediate');
  });

  it('defers to idle prefetch when table is hidden', () => {
    const result = resolveContactsLoadingStrategy({ showTable: false });

    expect(result).toBe('idle');
  });
});
