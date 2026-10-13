import { describe, expect, it } from 'vitest';

import { useContactsStore } from '@/stores/contact-table';

describe('contacts store import', () => {
  it('loads store definition without runtime ReferenceError', () => {
    expect(typeof useContactsStore).toBe('function');
  });
});
