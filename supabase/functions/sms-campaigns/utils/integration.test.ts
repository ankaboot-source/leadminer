/**
 * Integration smoke test for the timezone → region → phone normalization
 * pipeline used by the SMS composer.
 *
 * Flow:
 *   1. The browser reports the user's IANA timezone (e.g. "Africa/Tunis").
 *   2. `getRegionFromTimezone` maps it to a 2-letter ISO country code.
 *   3. The country code is passed as `defaultRegion` to the phone
 *      parser so unprefixed national-format numbers can be normalised.
 *
 * This test asserts the three steps compose correctly for the canonical
 * Tunisian case described in Lane C, plus a negative-validation case.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getRegionFromTimezone } from "./timezone-region.ts";
import { isValidPhoneNumber, normalizePhoneNumber } from "./phone.ts";

Deno.test(
  "integration: timezone → region → normalize (Africa/Tunis, valid number)",
  () => {
    const region = getRegionFromTimezone("Africa/Tunis");
    assertEquals(region, "TN");

    const normalized = normalizePhoneNumber("21697522154", region);
    assertEquals(normalized, "+21697522154");

    assertEquals(isValidPhoneNumber("21697522154", region), true);
  },
);

Deno.test(
  "integration: timezone → region → normalize (Africa/Tunis, invalid input)",
  () => {
    const region = getRegionFromTimezone("Africa/Tunis");
    assertEquals(region, "TN");

    // Non-numeric input must be rejected by the validator.
    assertEquals(isValidPhoneNumber("abc", region), false);

    // And it must be rejected by the normalizer as well.
    assertEquals(normalizePhoneNumber("abc", region), null);
  },
);
