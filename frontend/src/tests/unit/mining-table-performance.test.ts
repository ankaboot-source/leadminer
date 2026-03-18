import { describe, expect, it } from 'vitest';

import {
  buildColumnVisibility,
  prepareRowsForTable,
  toStateClass,
} from '@/utils/mining-table-performance';

describe('mining table performance helpers', () => {
  it('builds column visibility map once from visible columns', () => {
    const visibility = buildColumnVisibility(['contacts', 'name', 'status']);

    expect(visibility.contacts).toBe(true);
    expect(visibility.name).toBe(true);
    expect(visibility.status).toBe(true);
    expect(visibility.tags).toBe(false);
  });

  it('limits rendered tags to two and exposes overflow count', () => {
    const [row] = prepareRowsForTable(
      [
        {
          id: '1',
          user_id: 'u1',
          email: 'contact@example.com',
          name: 'John Doe',
          given_name: null,
          family_name: null,
          alternate_name: null,
          telephone: ['+33123456789'],
          location: null,
          location_normalized: null,
          works_for: null,
          job_title: null,
          same_as: ['https://linkedin.com/in/johndoe'],
          image: null,
          status: 'VALID',
          consent_status: 'opt_in',
          tags: ['professional', 'newsletter', 'chat', 'group'],
          temperature: 42,
        },
      ],
      {
        getStatusLabel: () => 'VALID',
        getStatusColor: () => 'success',
        getConsentLabel: () => 'Opt-in',
        getConsentColor: () => 'success',
      },
    );

    expect(row.visibleTags).toEqual(['professional', 'newsletter']);
    expect(row.hiddenTagsCount).toBe(2);
    expect(row.showSocialLinksAndPhones).toBe(true);
  });

  it('maps severities to lightweight css classes', () => {
    expect(toStateClass('success')).toBe('state-success');
    expect(toStateClass('danger')).toBe('state-danger');
    expect(toStateClass('secondary')).toBe('state-secondary');
  });
});
