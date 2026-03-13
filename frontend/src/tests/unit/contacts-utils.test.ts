import { beforeAll, describe, expect, it, vi } from 'vitest';

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
