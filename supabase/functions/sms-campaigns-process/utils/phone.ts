import { parsePhoneNumberFromString, ParseError } from "libphonenumber-js";

export function normalizePhoneNumber(phone: string): string | null {
  if (!phone?.trim()) return null;

  const trimmed = phone.trim();

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
