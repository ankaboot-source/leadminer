import { describe, expect, it } from 'vitest';

import {
  describeCronSchedule,
  isDailySchedule,
  isSameUtcDay,
} from '@/utils/cronSchedule';

describe('isDailySchedule', () => {
  it('accepts fixed time with wildcard days (the app cron shape)', () => {
    expect(isDailySchedule('0 2 * * *')).toBe(true);
    expect(isDailySchedule('30 14 * * *')).toBe(true);
  });

  it('rejects wildcard time fields', () => {
    // Every minute is not a daily fixed-time schedule.
    expect(isDailySchedule('* * * * *')).toBe(false);
    expect(isDailySchedule('*/30 2 * * *')).toBe(false);
  });

  it('rejects weekly/monthly/annual shapes', () => {
    expect(isDailySchedule('0 2 * * 1')).toBe(false); // Mondays
    expect(isDailySchedule('0 2 1 * *')).toBe(false); // 1st of month
    expect(isDailySchedule('0 2 1 1 *')).toBe(false); // yearly
  });

  it('rejects malformed and out-of-range expressions', () => {
    expect(isDailySchedule('0 2')).toBe(false); // too few fields
    expect(isDailySchedule('0 2 * * * *')).toBe(false); // too many fields
    expect(isDailySchedule('60 2 * * *')).toBe(false); // minute > 59
    expect(isDailySchedule('0 24 * * *')).toBe(false); // hour > 23
    expect(isDailySchedule('')).toBe(false);
  });
});

describe('describeCronSchedule', () => {
  it('describes the passive-mining cron with a padded UTC time', () => {
    const { schedule, time, nextRunAt } = describeCronSchedule('0 2 * * *');
    expect(schedule.key).toBe('common.passive_cron_daily');
    expect(time).toBe('02:00');
    expect(nextRunAt).not.toBeNull();
  });

  it('zero-pads single-digit times', () => {
    expect(describeCronSchedule('5 7 * * *').time).toBe('07:05');
  });

  it('computes the next daily occurrence strictly in the future', () => {
    const before = Date.now();
    const { nextRunAt } = describeCronSchedule('0 2 * * *');
    const next = nextRunAt?.getTime() ?? 0;

    expect(next).toBeGreaterThanOrEqual(before);
    expect(next - before).toBeLessThanOrEqual(24 * 60 * 60 * 1000);

    const date = nextRunAt as Date;
    expect(date.getUTCHours()).toBe(2);
    expect(date.getUTCMinutes()).toBe(0);
    expect(date.getUTCSeconds()).toBe(0);
    expect(date.getUTCMilliseconds()).toBe(0);
  });

  it('falls back to the raw expression for unsupported shapes', () => {
    const { schedule, time, nextRunAt } = describeCronSchedule('*/5 * * * *');
    expect(schedule.key).toBe('common.passive_cron_generic');
    expect(schedule.value).toEqual({ expression: '*/5 * * * *' });
    expect(time).toBeNull();
    expect(nextRunAt).toBeNull();
  });
});

describe('isSameUtcDay', () => {
  it('matches two dates on the same UTC calendar day', () => {
    expect(
      isSameUtcDay(
        new Date('2026-09-15T23:59:59Z'),
        new Date('2026-09-15T00:00:00Z'),
      ),
    ).toBe(true);
  });

  it('separates dates across the UTC midnight boundary', () => {
    expect(
      isSameUtcDay(
        new Date('2026-09-15T23:59:59Z'),
        new Date('2026-09-16T00:00:00Z'),
      ),
    ).toBe(false);
  });
});
