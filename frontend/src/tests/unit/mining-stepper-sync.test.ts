import { describe, expect, it } from 'vitest';

import {
  shouldApplyRunningStep,
  shouldInitStepperOnSignIn,
} from '@/utils/miningStepperSync';

describe('shouldInitStepperOnSignIn', () => {
  it('initializes on a genuine sign-in (null -> user)', () => {
    expect(
      shouldInitStepperOnSignIn({
        currentUser: { id: 'u1' },
        previousUser: null,
        isBusy: false,
      }),
    ).toBe(true);
  });

  it('initializes on first emission (undefined -> user)', () => {
    expect(
      shouldInitStepperOnSignIn({
        currentUser: { id: 'u1' },
        previousUser: undefined,
        isBusy: false,
      }),
    ).toBe(true);
  });

  it('ignores same-session re-emissions (token refresh swaps user identity)', () => {
    const user = { id: 'u1' };
    expect(
      shouldInitStepperOnSignIn({
        currentUser: { ...user },
        previousUser: user,
        isBusy: false,
      }),
    ).toBe(false);
  });

  it('never fights an in-flight start-mining / state restore', () => {
    expect(
      shouldInitStepperOnSignIn({
        currentUser: { id: 'u1' },
        previousUser: null,
        isBusy: true,
      }),
    ).toBe(false);
  });

  it('ignores sign-out and anonymous emissions', () => {
    expect(
      shouldInitStepperOnSignIn({
        currentUser: null,
        previousUser: { id: 'u1' },
        isBusy: false,
      }),
    ).toBe(false);
    expect(
      shouldInitStepperOnSignIn({
        currentUser: undefined,
        previousUser: undefined,
        isBusy: false,
      }),
    ).toBe(false);
  });
});

describe('shouldApplyRunningStep', () => {
  it('sets the stepper from the uninitialized state', () => {
    expect(shouldApplyRunningStep(-1, 1)).toBe(true);
    expect(shouldApplyRunningStep(-1, 3)).toBe(true);
  });

  it('applies only forward moves on an initialized stepper', () => {
    expect(shouldApplyRunningStep(1, 3)).toBe(true);
    expect(shouldApplyRunningStep(2, 3)).toBe(true);
  });

  it('never moves the stepper backward (stale active-run snapshot)', () => {
    expect(shouldApplyRunningStep(2, 1)).toBe(false);
    expect(shouldApplyRunningStep(3, 2)).toBe(false);
    expect(shouldApplyRunningStep(3, 1)).toBe(false);
  });

  it('rejects re-setting the same step', () => {
    expect(shouldApplyRunningStep(2, 2)).toBe(false);
  });

  it('rejects out-of-range or non-integer steps', () => {
    expect(shouldApplyRunningStep(1, 0)).toBe(false);
    expect(shouldApplyRunningStep(1, 4)).toBe(false);
    expect(shouldApplyRunningStep(Number.NaN, 2)).toBe(false);
    expect(shouldApplyRunningStep(1, Number.NaN)).toBe(false);
  });
});
