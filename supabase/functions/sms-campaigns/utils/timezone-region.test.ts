import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getRegionFromTimezone } from "./timezone-region.ts";
import { normalizePhoneNumber } from "./phone.ts";

Deno.test("getRegionFromTimezone maps African timezones", () => {
  assertEquals(getRegionFromTimezone("Africa/Tunis"), "TN");
  assertEquals(getRegionFromTimezone("Africa/Casablanca"), "MA");
  assertEquals(getRegionFromTimezone("Africa/Algiers"), "DZ");
  assertEquals(getRegionFromTimezone("Africa/Cairo"), "EG");
});

Deno.test("getRegionFromTimezone maps European timezones", () => {
  assertEquals(getRegionFromTimezone("Europe/Paris"), "FR");
  assertEquals(getRegionFromTimezone("Europe/Berlin"), "DE");
  assertEquals(getRegionFromTimezone("Europe/Madrid"), "ES");
  assertEquals(getRegionFromTimezone("Europe/Rome"), "IT");
  assertEquals(getRegionFromTimezone("Europe/London"), "GB");
  assertEquals(getRegionFromTimezone("Europe/Brussels"), "BE");
  assertEquals(getRegionFromTimezone("Europe/Amsterdam"), "NL");
  assertEquals(getRegionFromTimezone("Europe/Zurich"), "CH");
  assertEquals(getRegionFromTimezone("Europe/Luxembourg"), "LU");
});

Deno.test("getRegionFromTimezone maps North American timezones", () => {
  assertEquals(getRegionFromTimezone("America/New_York"), "US");
  assertEquals(getRegionFromTimezone("America/Chicago"), "US");
  assertEquals(getRegionFromTimezone("America/Denver"), "US");
  assertEquals(getRegionFromTimezone("America/Los_Angeles"), "US");
  assertEquals(getRegionFromTimezone("America/Toronto"), "CA");
  assertEquals(getRegionFromTimezone("America/Montreal"), "CA");
  assertEquals(getRegionFromTimezone("America/Vancouver"), "CA");
});

Deno.test(
  "getRegionFromTimezone returns null for ambiguous or unmapped timezones",
  () => {
    assertEquals(getRegionFromTimezone("UTC"), null);
    assertEquals(getRegionFromTimezone("Etc/UTC"), null);
    assertEquals(getRegionFromTimezone("GMT"), null);
    // Asia/Tokyo is intentionally not in the mapping table
    assertEquals(getRegionFromTimezone("Asia/Tokyo"), null);
    // Made-up timezone string
    assertEquals(getRegionFromTimezone("Mars/Olympus_Mons"), null);
  },
);

Deno.test(
  "getRegionFromTimezone returns null for nullish or empty input",
  () => {
    assertEquals(getRegionFromTimezone(null), null);
    assertEquals(getRegionFromTimezone(undefined), null);
    assertEquals(getRegionFromTimezone(""), null);
  },
);

Deno.test(
  "getRegionFromTimezone lookup is case-sensitive (IANA standard)",
  () => {
    // IANA timezone identifiers are case-sensitive: "africa/tunis" is not valid.
    assertEquals(getRegionFromTimezone("africa/tunis"), null);
    assertEquals(getRegionFromTimezone("AFRICA/TUNIS"), null);
  },
);

Deno.test(
  "normalizePhoneNumber accepts unprefixed national number when region is given",
  () => {
    // The bug: `21697522154` (no `+`) was rejected because no region was known.
    // With defaultRegion="TN", the parser recognises the Tunisian national format.
    assertEquals(normalizePhoneNumber("21697522154", "TN"), "+21697522154");
    // And the same logic works for any other mapped region.
    assertEquals(normalizePhoneNumber("0612345678", "FR"), "+33612345678");
    assertEquals(normalizePhoneNumber("2345678901", "US"), "+12345678901");
  },
);

Deno.test(
  "normalizePhoneNumber keeps international `+` numbers unchanged",
  () => {
    // Even without a region, a number that already starts with `+` is parsed
    // correctly because the `+` forces international-format interpretation.
    assertEquals(normalizePhoneNumber("+21697522154"), "+21697522154");
    // Passing a region that matches does not alter the result.
    assertEquals(normalizePhoneNumber("+21697522154", "TN"), "+21697522154");
    // Passing an unrelated region still respects the `+` and returns the same E.164.
    assertEquals(normalizePhoneNumber("+21697522154", "FR"), "+21697522154");
    assertEquals(normalizePhoneNumber("+33123456789", "FR"), "+33123456789");
    assertEquals(normalizePhoneNumber("+33123456789", "TN"), "+33123456789");
  },
);

Deno.test(
  "normalizePhoneNumber rejects numbers that are too short for the region",
  () => {
    // 123 has only 3 digits, too short for any country.
    assertEquals(normalizePhoneNumber("123", "FR"), null);
    assertEquals(normalizePhoneNumber("123", "TN"), null);
    assertEquals(normalizePhoneNumber("123", "US"), null);
  },
);

Deno.test(
  "normalizePhoneNumber rejects unprefixed numbers without a region",
  () => {
    // No `+` and no region: the parser has no way to know the country.
    assertEquals(normalizePhoneNumber("21697522154"), null);
    assertEquals(normalizePhoneNumber("1234567890"), null);
    assertEquals(normalizePhoneNumber("0612345678"), null);
  },
);

Deno.test("normalizePhoneNumber rejects mismatched region/number pairs", () => {
  // 21697522154 is a Tunisian national-format number, not a French one.
  // Passing "FR" makes the parser treat it as a French national number,
  // which fails the length/digit check and returns null.
  assertEquals(normalizePhoneNumber("21697522154", "FR"), null);
});

Deno.test(
  "region derived from timezone unlocks Tunisian number parsing",
  () => {
    // The full end-to-end flow: derive a region from the user's timezone,
    // then use it to parse a national-format phone number.
    const tunisianTimezone = "Africa/Tunis";
    const region = getRegionFromTimezone(tunisianTimezone);
    assertEquals(region, "TN");
    assertEquals(normalizePhoneNumber("21697522154", region), "+21697522154");
  },
);

Deno.test(
  "region derived from unmapped timezone does not unlock parsing",
  () => {
    // "UTC" is not in the mapping table, so getRegionFromTimezone returns null
    // and normalizePhoneNumber falls back to international-only parsing.
    const region = getRegionFromTimezone("UTC");
    assertEquals(region, null);
    assertEquals(normalizePhoneNumber("21697522154", region), null);
    // But the same user could still send an international-format number.
    assertEquals(normalizePhoneNumber("+21697522154", region), "+21697522154");
  },
);
