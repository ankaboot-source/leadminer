import { parsePhoneNumberFromString, ParseError } from "libphonenumber-js";

/**
 * Normalize a phone number to E.164 format.
 *
 * When `defaultRegion` is provided, unprefixed national-format numbers
 * are parsed in the context of that region (e.g. with `"TN"`, the input
 * `"21697522154"` is accepted as the Tunisian number `+21697522154`).
 * When `defaultRegion` is omitted or `null`, only numbers with an
 * explicit international prefix (`+` or `00...`) are accepted.
 *
 * @param phone - Raw phone number string from the user
 * @param defaultRegion - Optional 2-letter ISO country code (e.g. "TN", "FR")
 * @returns E.164-formatted number (e.g. `"+21697522154"`) or `null` if invalid
 */
export function normalizePhoneNumber(
  phone: string,
  defaultRegion?: string | null,
): string | null {
  if (!phone?.trim()) return null;

  const trimmed = phone.trim();

  try {
    const phoneNumber = parsePhoneNumberFromString(
      trimmed,
      defaultRegion ?? undefined,
    );
    if (!phoneNumber || !phoneNumber.isValid()) {
      return null;
    }
    return phoneNumber.format("E.164");
  } catch (error) {
    if (error instanceof ParseError) {
      return null;
    }
    throw error;
  }
}

/**
 * Check whether a phone number is valid and can be normalized to E.164.
 *
 * See {@link normalizePhoneNumber} for details on the `defaultRegion` parameter.
 *
 * @param phone - Raw phone number string (or `null`)
 * @param defaultRegion - Optional 2-letter ISO country code (e.g. "TN", "FR")
 * @returns `true` if the number is valid and can be normalized, `false` otherwise
 */
export function isValidPhoneNumber(
  phone: string | null,
  defaultRegion?: string | null,
): boolean {
  if (!phone) return false;
  return normalizePhoneNumber(phone, defaultRegion) !== null;
}
