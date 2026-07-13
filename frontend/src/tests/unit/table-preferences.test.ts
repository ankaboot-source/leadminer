import { describe, expect, it } from 'vitest';

import {
  buildTableStorageKey,
  parseStoredFilters,
  sanitizeVisibleColumns,
} from '@/utils/table-preferences';

describe('table preferences helpers', () => {
  it('builds stable storage keys per user and origin', () => {
    expect(buildTableStorageKey('filters', 'user-1', 'contacts')).toBe(
      'leadminer:v1:table:filters:user-1:contacts',
    );
    expect(buildTableStorageKey('columns', 'user-2', 'mine')).toBe(
      'leadminer:v1:table:columns:user-2:mine',
    );
  });

  it('sanitizes visible columns without forcing any column', () => {
    const withContacts = sanitizeVisibleColumns([
      'temperature',
      'unknown_column',
      'contacts',
      'temperature',
    ]);

    expect(withContacts).toEqual(['temperature', 'contacts']);

    const withoutContacts = sanitizeVisibleColumns([
      'temperature',
      'name',
      'contacts',
    ]).filter((column) => column !== 'contacts');

    expect(withoutContacts).toEqual(['temperature', 'name']);
  });

  it('restores Date values in date filters from JSON', () => {
    const raw = JSON.stringify({
      recency: { constraints: [{ value: '2026-01-01T00:00:00.000Z' }] },
      source: { constraints: [{ value: 'sales' }] },
    });

    const parsed = parseStoredFilters(raw);

    expect(parsed.recency.constraints[0].value).toBeInstanceOf(Date);
    expect(parsed.recency.constraints[0].value.toISOString()).toBe(
      '2026-01-01T00:00:00.000Z',
    );
    expect(parsed.source.constraints[0].value).toBe('sales');
  });

  it('returns null for invalid stored filters', () => {
    expect(parseStoredFilters('{not-json')).toBeNull();
  });
});
