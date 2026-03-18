import { describe, expect, it } from 'vitest';

import { computeRetryDelay, isFatalSseErrorMessage } from '@/utils/sse';

describe('sse retry guards', () => {
  it('marks setup/task-not-found errors as fatal', () => {
    expect(isFatalSseErrorMessage('must set up consumer group first')).toBe(
      true,
    );
    expect(isFatalSseErrorMessage('Task not found for miningId=abc')).toBe(
      true,
    );
  });

  it('keeps transient network errors retryable', () => {
    expect(
      isFatalSseErrorMessage('NetworkError when attempting to fetch resource.'),
    ).toBe(false);
  });

  it('returns backoff delays then stops at max retries', () => {
    expect(computeRetryDelay(1, 3)).toBe(1000);
    expect(computeRetryDelay(2, 3)).toBe(2000);
    expect(computeRetryDelay(3, 3)).toBeNull();
  });
});
