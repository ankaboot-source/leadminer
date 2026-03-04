import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

function normalizePhoneNumber(phone: string): string | null {
  const cleaned = phone.replace(/[\s\-\(\)\.\+]/g, "");
  const e164Match = cleaned.match(/^\+?(\d{10,15})$/);
  if (!e164Match) return null;
  const digits = e164Match[1];
  if (digits.length >= 10) {
    return `+${digits}`;
  }
  return null;
}

function isValidPhoneNumber(phone: string | null): boolean {
  if (!phone) return false;
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return false;
  return normalized.replace(/\D/g, "").length >= 10;
}

Deno.test("normalizePhoneNumber formats valid numbers to E.164", () => {
  assertEquals(normalizePhoneNumber("+1234567890"), "+1234567890");
  assertEquals(normalizePhoneNumber("1234567890"), "+1234567890");
  assertEquals(normalizePhoneNumber("+33 1 23 45 67 89"), "+33123456789");
  assertEquals(normalizePhoneNumber("+33(0)123456789"), "+33123456789");
  assertEquals(normalizePhoneNumber("0033123456789"), "+33123456789");
});

Deno.test("normalizePhoneNumber returns null for invalid numbers", () => {
  assertEquals(normalizePhoneNumber("abc"), null);
  assertEquals(normalizePhoneNumber("123"), null);
  assertEquals(normalizePhoneNumber(""), null);
  assertEquals(normalizePhoneNumber("+"), null);
});

Deno.test("isValidPhoneNumber validates E.164 numbers with 10+ digits", () => {
  assertEquals(isValidPhoneNumber("+1234567890"), true);
  assertEquals(isValidPhoneNumber("+33123456789"), true);
  assertEquals(isValidPhoneNumber("1234567890"), true);
  assertEquals(isValidPhoneNumber("+123456789"), false);
  assertEquals(isValidPhoneNumber("12345"), false);
  assertEquals(isValidPhoneNumber(null), false);
  assertEquals(isValidPhoneNumber(""), false);
  assertEquals(isValidPhoneNumber("abc"), false);
});

Deno.test("phone normalization handles various formats", () => {
  const testCases = [
    { input: "+1 (234) 567-8901", expected: "+12345678901" },
    { input: "34 612 345 678", expected: "+34612345678" },
    { input: "+49 160 1234567", expected: "+491601234567" },
    { input: "0049 160 1234567", expected: "+491601234567" },
    { input: "+44 20 7946 0958", expected: "+442079460958" },
  ];

  for (const { input, expected } of testCases) {
    assertEquals(normalizePhoneNumber(input), expected);
  }
});