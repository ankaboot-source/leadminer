import { parsePhoneNumberFromString, ParseError } from "libphonenumber-js";

export function normalizePhoneNumber(phone: string): string | null {
  if (!phone?.trim()) return null;

  let trimmed = phone.trim();

  // Normalize to international format with '+' prefix
  if (trimmed.startsWith("00")) {
    // Replace international dialing prefix (00) with +
    trimmed = `+${trimmed.slice(2)}`;
  } else if (!trimmed.startsWith("+")) {
    // Prepend + for numbers without it (assumes country code is included)
    trimmed = `+${trimmed}`;
  }

  try {
    const phoneNumber = parsePhoneNumberFromString(trimmed);
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

export function isValidPhoneNumber(phone: string | null): boolean {
  if (!phone) return false;
  return normalizePhoneNumber(phone) !== null;
}
