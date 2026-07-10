import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isValidPhoneNumber, normalizePhoneNumber } from "./phone.ts";

// Note: libphonenumber-js has no implicit "default region" — when no
// `defaultRegion` is supplied, only numbers that start with `+` (or
// another recognised international prefix) are accepted. The tests below
// mirror that behaviour. For unprefixed national numbers, pass a
// `defaultRegion` explicitly (see the `defaultRegion` test group below).

Deno.test(
  "normalizePhoneNumber formats international numbers to E.164 (no region)",
  () => {
    assertEquals(normalizePhoneNumber("+33 1 23 45 67 89"), "+33123456789");
    assertEquals(normalizePhoneNumber("+33(0)123456789"), "+33123456789");
    assertEquals(normalizePhoneNumber("+1 (234) 567-8901"), "+12345678901");
    assertEquals(normalizePhoneNumber("+49 160 1234567"), "+491601234567");
    assertEquals(normalizePhoneNumber("+44 20 7946 0958"), "+442079460958");
    // +21697522154 is a valid Tunisian number even without a region hint,
    // because the `+` forces international-format parsing.
    assertEquals(normalizePhoneNumber("+21697522154"), "+21697522154");
  },
);

Deno.test("normalizePhoneNumber returns null for invalid numbers", () => {
  assertEquals(normalizePhoneNumber("abc"), null);
  assertEquals(normalizePhoneNumber("123"), null);
  assertEquals(normalizePhoneNumber(""), null);
  assertEquals(normalizePhoneNumber("+"), null);
  // 10 raw digits with no `+` and no region cannot be parsed.
  assertEquals(normalizePhoneNumber("1234567890"), null);
  // 00-prefixed international numbers (e.g. "0033...") need a region hint
  // or a leading `+` to be recognised as international format.
  assertEquals(normalizePhoneNumber("0033123456789"), null);
});

Deno.test("isValidPhoneNumber (no region) accepts `+`-prefixed numbers", () => {
  assertEquals(isValidPhoneNumber("+33123456789"), true);
  assertEquals(isValidPhoneNumber("+12345678901"), true);
  assertEquals(isValidPhoneNumber("+21697522154"), true);
});

Deno.test(
  "isValidPhoneNumber (no region) rejects unprefixed national numbers",
  () => {
    // Without a region, raw national digits cannot be parsed.
    assertEquals(isValidPhoneNumber("1234567890"), false);
    assertEquals(isValidPhoneNumber("21697522154"), false);
    // +123456789 has only 10 digits, not enough for a valid US E.164.
    assertEquals(isValidPhoneNumber("+123456789"), false);
    assertEquals(isValidPhoneNumber("12345"), false);
    assertEquals(isValidPhoneNumber(null), false);
    assertEquals(isValidPhoneNumber(""), false);
    assertEquals(isValidPhoneNumber("abc"), false);
  },
);

Deno.test(
  "normalizePhoneNumber uses defaultRegion to parse national numbers",
  () => {
    // The fix: with a region hint, unprefixed national numbers are accepted.
    assertEquals(normalizePhoneNumber("21697522154", "TN"), "+21697522154");
    assertEquals(normalizePhoneNumber("0612345678", "FR"), "+33612345678");
    assertEquals(normalizePhoneNumber("2345678901", "US"), "+12345678901");
    // Passing a region for an already-international number is a no-op.
    assertEquals(normalizePhoneNumber("+21697522154", "TN"), "+21697522154");
    assertEquals(normalizePhoneNumber("+33123456789", "FR"), "+33123456789");
  },
);

Deno.test(
  "normalizePhoneNumber handles spacing and punctuation in national numbers",
  () => {
    // National numbers with `+` prefix can use any reasonable digit grouping.
    assertEquals(normalizePhoneNumber("+216 975 221 54"), "+21697522154");
    assertEquals(normalizePhoneNumber("+216 97 52 21 54"), "+21697522154");
    // French 10-digit national number with region hint.
    assertEquals(normalizePhoneNumber("01 23 45 67 89", "FR"), "+33123456789");
    // `null` is coerced to `undefined` internally, behaving like no region.
    assertEquals(normalizePhoneNumber("+21697522154", null), "+21697522154");
    assertEquals(normalizePhoneNumber("21697522154", null), null);
  },
);

Deno.test(
  "isValidPhoneNumber uses defaultRegion to validate national numbers",
  () => {
    assertEquals(isValidPhoneNumber("21697522154", "TN"), true);
    assertEquals(isValidPhoneNumber("0612345678", "FR"), true);
    assertEquals(isValidPhoneNumber("21697522154", "FR"), false); // not French
    // Too short for any region.
    assertEquals(isValidPhoneNumber("123", "FR"), false);
    // null region behaves like no region.
    assertEquals(isValidPhoneNumber("21697522154", null), false);
    assertEquals(isValidPhoneNumber(null, "TN"), false);
  },
);

Deno.test(
  "phone normalization handles various formats with defaultRegion",
  () => {
    const testCases = [
      { input: "+1 (234) 567-8901", expected: "+12345678901", region: "US" },
      { input: "34 612 345 678", expected: null, region: null },
      { input: "+49 160 1234567", expected: "+491601234567", region: "DE" },
      { input: "0049 160 1234567", expected: null, region: null },
      { input: "+44 20 7946 0958", expected: "+442079460958", region: "GB" },
      { input: "21697522154", expected: "+21697522154", region: "TN" },
    ];

    for (const { input, expected, region } of testCases) {
      assertEquals(normalizePhoneNumber(input, region), expected);
    }
  },
);
