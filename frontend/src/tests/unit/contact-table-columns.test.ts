import { describe, expect, it } from 'vitest';
import { getDefaultVisibleColumns } from '@/utils/table-preferences';

describe('getDefaultVisibleColumns', () => {
  it('keeps the works-for column in the contacts view', () => {
    expect(getDefaultVisibleColumns('contacts')).toContain('works_for');
  });

  it('does not expose works-for as a mine column', () => {
    expect(getDefaultVisibleColumns('mine')).not.toContain('works_for');
  });
});
