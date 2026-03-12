import { describe, expect, it } from 'vitest';

import {
  extractUnavailableSenderEmails,
  getUnavailableSenderReconnectContext,
} from '@/utils/senderOptions';

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

describe('getUnavailableSenderReconnectContext', () => {
  it('returns none when there are no unavailable senders', () => {
    expect(getUnavailableSenderReconnectContext([])).toEqual({
      mode: 'none',
    });
  });

  it('returns single mode with email when exactly one sender is unavailable', () => {
    expect(
      getUnavailableSenderReconnectContext(['imap-user@example.com']),
    ).toEqual({
      mode: 'single',
      email: 'imap-user@example.com',
    });
  });

  it('returns multiple mode when more than one sender is unavailable', () => {
    expect(
      getUnavailableSenderReconnectContext([
        'first@example.com',
        'second@example.com',
      ]),
    ).toEqual({
      mode: 'multiple',
    });
  });
});
