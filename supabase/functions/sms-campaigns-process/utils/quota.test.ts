import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  getLocalTimeBounds,
  getSmsQuotaFromEnv,
  parseQuotaValue,
} from "./quota.ts";

Deno.test("getSmsQuotaFromEnv returns defaults when env vars not set", () => {
  const quota = getSmsQuotaFromEnv(() => undefined);
  assertEquals(quota.dailyLimit, 200);
  assertEquals(quota.monthlyRecipientLimit, 200);
});

Deno.test("getSmsQuotaFromEnv parses valid env values", () => {
  const values = {
    SMS_CAMPAIGN_DAILY_LIMIT: "500",
    SMS_CAMPAIGN_MONTHLY_RECIPIENT_LIMIT: "1000",
  } as Record<string, string>;
  const quota = getSmsQuotaFromEnv((key) => values[key]);
  assertEquals(quota.dailyLimit, 500);
  assertEquals(quota.monthlyRecipientLimit, 1000);
});

Deno.test("getSmsQuotaFromEnv treats 0 as unlimited", () => {
  const values = {
    SMS_CAMPAIGN_DAILY_LIMIT: "0",
    SMS_CAMPAIGN_MONTHLY_RECIPIENT_LIMIT: "0",
  } as Record<string, string>;
  const quota = getSmsQuotaFromEnv((key) => values[key]);
  assertEquals(quota.dailyLimit, 0);
  assertEquals(quota.monthlyRecipientLimit, 0);
});

Deno.test("getSmsQuotaFromEnv falls back on invalid values", () => {
  const values = {
    SMS_CAMPAIGN_DAILY_LIMIT: "invalid",
    SMS_CAMPAIGN_MONTHLY_RECIPIENT_LIMIT: "",
  } as Record<string, string>;
  const quota = getSmsQuotaFromEnv((key) => values[key]);
  assertEquals(quota.dailyLimit, 200);
  assertEquals(quota.monthlyRecipientLimit, 200);
});

Deno.test("parseQuotaValue returns default for invalid values", () => {
  assertEquals(parseQuotaValue(undefined, 200), 200);
  assertEquals(parseQuotaValue("", 200), 200);
  assertEquals(parseQuotaValue("abc", 200), 200);
  assertEquals(parseQuotaValue("150", 200), 150);
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
