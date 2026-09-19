import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { Contact } from '~/types/contact';

beforeAll(() => {
  vi.stubGlobal('defineStore', () => () => ({}));
});

describe('convertDates', () => {
  it('converts consent_changed_at into a Date object', async () => {
    const { convertDates } = await import('@/utils/contacts');
    const contacts = [
      {
        email: 'contact@example.com',
        consent_changed_at: '2026-03-13T10:00:00.000Z',
      },
    ] as never[];

    const [converted] = convertDates(contacts);

    expect(converted.consent_changed_at).toBeInstanceOf(Date);
    expect(converted.consent_changed_at?.toISOString()).toBe(
      '2026-03-13T10:00:00.000Z',
    );
  });
});

describe('shouldSkipEnrichDialog', () => {
  it('shows the dialog when the contact already has details', async () => {
    const { shouldSkipEnrichDialog } = await import('@/utils/contacts');

    expect(shouldSkipEnrichDialog({ given_name: 'Ada' } as Contact)).toBe(
      false,
    );
    expect(
      shouldSkipEnrichDialog({ telephone: ['+123456789'] } as Contact),
    ).toBe(false);
  });

  it('skips the dialog when the contact has no details yet', async () => {
    const { shouldSkipEnrichDialog } = await import('@/utils/contacts');

    expect(shouldSkipEnrichDialog()).toBe(true);
    expect(shouldSkipEnrichDialog(null)).toBe(true);
    expect(
      shouldSkipEnrichDialog({ email: 'contact@example.com' } as Contact),
    ).toBe(true);
  });
});
