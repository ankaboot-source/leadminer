import { describe, expect, it } from 'vitest';

import type { Contact } from '@/types/contact';
import { resolveMiningTableRows } from '@/utils/mining-table';

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
