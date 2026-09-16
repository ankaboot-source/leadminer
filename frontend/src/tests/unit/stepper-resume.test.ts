import { describe, expect, it } from 'vitest';

import {
  shouldApplyResumeStep,
  shouldResumeOnUserChange,
} from '@/utils/stepperResume';

describe('shouldResumeOnUserChange', () => {
  it('resumes on a genuine sign-in (null -> user)', () => {
    expect(
      shouldResumeOnUserChange({
        currentUser: { id: 'u1' },
        previousUser: null,
        isBusy: false,
      }),
    ).toBe(true);
  });

  it('resumes on first emission (undefined -> user)', () => {
    expect(
      shouldResumeOnUserChange({
        currentUser: { id: 'u1' },
        previousUser: undefined,
        isBusy: false,
      }),
    ).toBe(true);
  });

  it('ignores same-session re-emissions (token refresh swaps user identity)', () => {
    const user = { id: 'u1' };
    expect(
      shouldResumeOnUserChange({
        currentUser: { ...user },
        previousUser: user,
        isBusy: false,
      }),
    ).toBe(false);
  });

  it('never fights an in-flight start-mining / resume flow', () => {
    expect(
      shouldResumeOnUserChange({
        currentUser: { id: 'u1' },
        previousUser: null,
        isBusy: true,
      }),
    ).toBe(false);
  });

  it('ignores sign-out and anonymous emissions', () => {
    expect(
      shouldResumeOnUserChange({
        currentUser: null,
        previousUser: { id: 'u1' },
        isBusy: false,
      }),
    ).toBe(false);
    expect(
      shouldResumeOnUserChange({
        currentUser: undefined,
        previousUser: undefined,
        isBusy: false,
      }),
    ).toBe(false);
  });
});

describe('shouldApplyResumeStep', () => {
  it('applies a resume into the uninitialized stepper', () => {
    expect(shouldApplyResumeStep(-1, 1)).toBe(true);
    expect(shouldApplyResumeStep(-1, 3)).toBe(true);
  });

  it('applies only forward moves on an initialized stepper', () => {
    expect(shouldApplyResumeStep(1, 3)).toBe(true);
    expect(shouldApplyResumeStep(2, 3)).toBe(true);
  });

  it('never moves the stepper backward (stale active-run snapshot)', () => {
    expect(shouldApplyResumeStep(2, 1)).toBe(false);
    expect(shouldApplyResumeStep(3, 2)).toBe(false);
    expect(shouldApplyResumeStep(3, 1)).toBe(false);
  });

  it('rejects re-setting the same step', () => {
    expect(shouldApplyResumeStep(2, 2)).toBe(false);
  });

  it('rejects out-of-range or non-integer steps', () => {
    expect(shouldApplyResumeStep(1, 0)).toBe(false);
    expect(shouldApplyResumeStep(1, 4)).toBe(false);
    expect(shouldApplyResumeStep(Number.NaN, 2)).toBe(false);
    expect(shouldApplyResumeStep(1, Number.NaN)).toBe(false);
  });
});
