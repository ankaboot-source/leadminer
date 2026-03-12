import { describe, expect, it } from 'vitest';
import { resolveReconnectFallbackAction } from '@/utils/reconnectFallback';

describe('resolveReconnectFallbackAction', () => {
  it('returns google for gmail domains', () => {
    expect(resolveReconnectFallbackAction('user@gmail.com')).toBe('google');
    expect(resolveReconnectFallbackAction('user@googlemail.com')).toBe(
      'google',
    );
  });

  it('returns azure for microsoft-hosted domains', () => {
    expect(resolveReconnectFallbackAction('user@outlook.com')).toBe('azure');
    expect(resolveReconnectFallbackAction('user@hotmail.com')).toBe('azure');
    expect(resolveReconnectFallbackAction('user@live.com')).toBe('azure');
  });

  it('returns imap for other domains', () => {
    expect(resolveReconnectFallbackAction('user@example.com')).toBe('imap');
  });
});
