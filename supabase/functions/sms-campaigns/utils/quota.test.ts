import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

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

function getSmsQuota(): { dailyLimit: number; monthlyRecipientLimit: number } {
  return {
    dailyLimit: getEnvQuota("SMS_CAMPAIGN_DAILY_LIMIT", 200),
    monthlyRecipientLimit: getEnvQuota("SMS_CAMPAIGN_MONTHLY_RECIPIENT_LIMIT", 200),
  };
}

function getLocalTimeBounds(timezone: string): { dayStart: Date; monthStart: Date } {
  const now = new Date();
  
  const dayStart = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
  dayStart.setHours(0, 0, 0, 0);
  
  const monthStart = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  
  return { dayStart, monthStart };
}

Deno.test("getSmsQuota returns defaults when env vars not set", () => {
  Deno.env.delete("SMS_CAMPAIGN_DAILY_LIMIT");
  Deno.env.delete("SMS_CAMPAIGN_MONTHLY_RECIPIENT_LIMIT");
  
  const quota = getSmsQuota();
  assertEquals(quota.dailyLimit, 200);
  assertEquals(quota.monthlyRecipientLimit, 200);
});

Deno.test("getSmsQuota parses valid env values", () => {
  Deno.env.set("SMS_CAMPAIGN_DAILY_LIMIT", "500");
  Deno.env.set("SMS_CAMPAIGN_MONTHLY_RECIPIENT_LIMIT", "1000");
  
  const quota = getSmsQuota();
  assertEquals(quota.dailyLimit, 500);
  assertEquals(quota.monthlyRecipientLimit, 1000);
  
  Deno.env.delete("SMS_CAMPAIGN_DAILY_LIMIT");
  Deno.env.delete("SMS_CAMPAIGN_MONTHLY_RECIPIENT_LIMIT");
});

Deno.test("getSmsQuota treats 0 as unlimited", () => {
  Deno.env.set("SMS_CAMPAIGN_DAILY_LIMIT", "0");
  Deno.env.set("SMS_CAMPAIGN_MONTHLY_RECIPIENT_LIMIT", "0");
  
  const quota = getSmsQuota();
  assertEquals(quota.dailyLimit, 0);
  assertEquals(quota.monthlyRecipientLimit, 0);
  
  Deno.env.delete("SMS_CAMPAIGN_DAILY_LIMIT");
  Deno.env.delete("SMS_CAMPAIGN_MONTHLY_RECIPIENT_LIMIT");
});

Deno.test("getSmsQuota falls back on invalid values", () => {
  Deno.env.set("SMS_CAMPAIGN_DAILY_LIMIT", "invalid");
  Deno.env.set("SMS_CAMPAIGN_MONTHLY_RECIPIENT_LIMIT", "");
  
  const quota = getSmsQuota();
  assertEquals(quota.dailyLimit, 200);
  assertEquals(quota.monthlyRecipientLimit, 200);
  
  Deno.env.delete("SMS_CAMPAIGN_DAILY_LIMIT");
  Deno.env.delete("SMS_CAMPAIGN_MONTHLY_RECIPIENT_LIMIT");
});

Deno.test("getLocalTimeBounds returns valid dates", () => {
  const bounds = getLocalTimeBounds("UTC");
  
  assertEquals(bounds.dayStart.getHours(), 0);
  assertEquals(bounds.dayStart.getMinutes(), 0);
  assertEquals(bounds.dayStart.getSeconds(), 0);
  
  assertEquals(bounds.monthStart.getDate(), 1);
  assertEquals(bounds.monthStart.getHours(), 0);
});

Deno.test("getLocalTimeBounds handles different timezones", () => {
  const utc = getLocalTimeBounds("UTC");
  const paris = getLocalTimeBounds("Europe/Paris");
  const tokyo = getLocalTimeBounds("Asia/Tokyo");
  
  assertExists(utc.dayStart);
  assertExists(paris.dayStart);
  assertExists(tokyo.dayStart);
});