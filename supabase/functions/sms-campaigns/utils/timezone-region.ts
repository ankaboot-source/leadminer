/**
 * Maps IANA timezone strings to 2-letter country codes.
 *
 * Used to derive a `defaultRegion` for `libphonenumber-js` so that
 * unprefixed national-format phone numbers (e.g. `21697522154`) can be
 * parsed when the calling user is in a known region.
 *
 * Mappings are intentionally limited to timezones that map to a single
 * country. Ambiguous zones (e.g. `UTC`, `Europe/London` which is shared
 * across the UK and overseas territories) are deliberately omitted and
 * return `null`.
 *
 * To add a mapping, append a key/value pair to `TIMEZONE_TO_REGION`.
 * Keep entries sorted by timezone name for easy scanning.
 */
const TIMEZONE_TO_REGION: Record<string, string> = {
  // Africa
  "Africa/Algiers": "DZ",
  "Africa/Cairo": "EG",
  "Africa/Casablanca": "MA",
  "Africa/Tunis": "TN",
  // Europe
  "Europe/Amsterdam": "NL",
  "Europe/Berlin": "DE",
  "Europe/Brussels": "BE",
  "Europe/London": "GB",
  "Europe/Luxembourg": "LU",
  "Europe/Madrid": "ES",
  "Europe/Paris": "FR",
  "Europe/Rome": "IT",
  "Europe/Zurich": "CH",
  // North America
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Los_Angeles": "US",
  "America/Montreal": "CA",
  "America/New_York": "US",
  "America/Toronto": "CA",
  "America/Vancouver": "CA",
};

/**
 * Map an IANA timezone string to a 2-letter ISO country code.
 *
 * Returns `null` for timezones that are not in the mapping table,
 * including `UTC` and any timezone that does not unambiguously map
 * to a single country. A `null` or empty input also returns `null`.
 *
 * The returned value is suitable for the `defaultRegion` parameter
 * of `libphonenumber-js`'s `parsePhoneNumberFromString`.
 *
 * @param timezone - IANA timezone string (e.g. "Africa/Tunis")
 * @returns 2-letter country code (e.g. "TN") or `null` if unmapped
 *
 * @example
 * getRegionFromTimezone("Africa/Tunis") // => "TN"
 * getRegionFromTimezone("UTC")          // => null
 * getRegionFromTimezone(undefined)      // => null
 */
export function getRegionFromTimezone(
  timezone: string | null | undefined,
): string | null {
  if (!timezone) return null;
  return TIMEZONE_TO_REGION[timezone] ?? null;
}
