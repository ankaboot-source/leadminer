interface QuotaConfig {
  dailyLimit: number;
  monthlyRecipientLimit: number;
}

function getEnvQuota(key: string, defaultValue: number): number {
  const value = Deno.env.get(key);
  if (!value || value === "") {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    console.warn(`Invalid ${key}, using default: ${defaultValue}`);
    return defaultValue;
  }
  return parsed;
}

export function getSmsQuota(): QuotaConfig {
  return {
    dailyLimit: getEnvQuota("SMS_CAMPAIGN_DAILY_LIMIT", 200),
    monthlyRecipientLimit: getEnvQuota("SMS_CAMPAIGN_MONTHLY_RECIPIENT_LIMIT", 200),
  };
}

export function getLocalTimeBounds(timezone: string): { dayStart: Date; monthStart: Date } {
  const now = new Date();
  
  const dayStartStr = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
  dayStartStr.setHours(0, 0, 0, 0);
  
  const monthStartStr = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
  monthStartStr.setDate(1);
  monthStartStr.setHours(0, 0, 0, 0);
  
  return { dayStart: dayStartStr, monthStart: monthStartStr };
}