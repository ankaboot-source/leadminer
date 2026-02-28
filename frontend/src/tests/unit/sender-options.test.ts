import { describe, expect, it } from 'vitest';

import { extractUnavailableSenderEmails } from '@/utils/senderOptions';

describe('extractUnavailableSenderEmails', () => {
  it('returns only unavailable sender emails', () => {
    const result = extractUnavailableSenderEmails([
      { email: 'available@example.com', available: true },
      { email: 'expired@gmail.com', available: false },
      { email: 'locked@outlook.com', available: false },
    ]);

    expect(result).toEqual(['expired@gmail.com', 'locked@outlook.com']);
  });

  it('deduplicates unavailable emails and ignores blank values', () => {
    const result = extractUnavailableSenderEmails([
      { email: 'EXPIRED@gmail.com', available: false },
      { email: 'expired@gmail.com', available: false },
      { email: '   ', available: false },
      { email: '', available: false },
    ]);

    expect(result).toEqual(['expired@gmail.com']);
  });
});
