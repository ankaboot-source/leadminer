interface QuotaConfig {
  dailyLimit: number;
  monthlyRecipientLimit: number;
}

export function parseQuotaValue(
  value: string | undefined,
  defaultValue: number,
): number {
  if (!value || value === "") {
    return defaultValue;
  }

  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    return defaultValue;
  }

  return parsed;
}

export function getSmsQuotaFromEnv(
  getEnv: (key: string) => string | undefined,
): QuotaConfig {
  return {
    dailyLimit: parseQuotaValue(getEnv("SMS_CAMPAIGN_DAILY_LIMIT"), 200),
    monthlyRecipientLimit: parseQuotaValue(
      getEnv("SMS_CAMPAIGN_MONTHLY_RECIPIENT_LIMIT"),
      200,
    ),
  };
}

export function getSmsQuota(): QuotaConfig {
  return getSmsQuotaFromEnv((key) => Deno.env.get(key));
}

export function getLocalTimeBounds(timezone: string): {
  dayStart: Date;
  monthStart: Date;
} {
  const now = new Date();

  const safeTimezone = (() => {
    try {
      Intl.DateTimeFormat("en-US", { timeZone: timezone });
      return timezone;
    } catch {
      return "UTC";
    }
  })();

  const dayStartStr = new Date(
    now.toLocaleString("en-US", { timeZone: safeTimezone }),
  );
  dayStartStr.setHours(0, 0, 0, 0);

  const monthStartStr = new Date(
    now.toLocaleString("en-US", { timeZone: safeTimezone }),
  );
  monthStartStr.setDate(1);
  monthStartStr.setHours(0, 0, 0, 0);

  return { dayStart: dayStartStr, monthStart: monthStartStr };
}
