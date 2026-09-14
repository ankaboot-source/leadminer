/**
 * Minimal cron-schedule describer for the app's own cron jobs (no dependency).
 * Keep in sync with supabase/migrations/*_passive_mining_cron_job.sql.
 */

const FIELD_MAX = { minute: 59, hour: 23, dom: 31, month: 12, dow: 6 } as const;

function isEveryValue(field: string, max: number): boolean {
  return field === '*' || field === '*/1' || field === `0-${max}`;
}

function isFixedNumber(field: string): boolean {
  return /^\d+$/.test(field);
}

/**
 * True when the expression runs at the same time every day:
 * fixed minute + fixed hour, wildcard day/month/weekday (e.g. "0 2 * * *").
 */
export function isDailySchedule(expression: string): boolean {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  const [minute = '', hour = '', dom = '', month = '', dow = ''] = fields;
  return (
    isFixedNumber(minute) &&
    Number(minute) <= FIELD_MAX.minute &&
    isFixedNumber(hour) &&
    Number(hour) <= FIELD_MAX.hour &&
    isEveryValue(dom, FIELD_MAX.dom) &&
    isEveryValue(month, FIELD_MAX.month) &&
    isEveryValue(dow, FIELD_MAX.dow)
  );
}

function nextDailyOccurrence(hour: number, minute: number, now: Date): Date {
  const next = new Date(now);
  next.setUTCHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

function isSameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export type CronScheduleDescription = {
  /** i18n key (+ params) describing the cadence, e.g. "every day". */
  schedule: { key: string; value: Record<string, unknown> | null };
  /** Zero-padded "HH:MM" in UTC, when the schedule has a fixed time. */
  time: string | null;
  /** Next occurrence (UTC), when computable; "today" vs "tomorrow" is derived from it. */
  nextRunAt: Date | null;
};

/**
 * Human-readable pieces of a schedule as i18n keys — strings stay out of this
 * module so it needs no locale knowledge.
 */
export function describeCronSchedule(
  expression: string,
): CronScheduleDescription {
  const fields = expression.trim().split(/\s+/);

  // Daily at HH:MM (UTC) — the shape this app actually uses.
  if (isDailySchedule(expression) && fields.length === 5) {
    const [minute = '0', hour = '0'] = fields;
    return {
      schedule: { key: 'common.passive_cron_daily', value: null },
      time: `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`,
      nextRunAt: nextDailyOccurrence(Number(hour), Number(minute), new Date()),
    };
  }

  // Generic fallback: show the raw expression rather than a wrong sentence.
  return {
    schedule: { key: 'common.passive_cron_generic', value: { expression } },
    time: null,
    nextRunAt: null,
  };
}

export { isSameUtcDay };
