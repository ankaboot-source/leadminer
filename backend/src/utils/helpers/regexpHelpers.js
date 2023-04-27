import { decode } from 'html-entities';
import { decode as _decode } from 'quoted-printable';
import {
  REGEX_BODY,
  REGEX_HEADER,
  REGEX_HEADER_EMAIL_SPLIT_PATTERN,
  REGEX_REMOVE_QUOTES
} from '../constants';

/**
 * Extract Emails from body.
 * @param  {string} data A string that represents the mail body
 * @returns {Array} array of strings
 */
export function extractNameAndEmailFromBody(data) {
  const reg = _decode(data).match(REGEX_BODY);
  if (reg) {
    return [...new Set(reg)];
  }
  return [];
}

/**
 * Returns the extracted name from a space-seperated name email input.
 * @param {string} name - The input from which the name is extracted.
 * @returns {string} The extracted name, or an empty string if no name is found.
 */
export function cleanName(name) {
  const cleanedName = name
    .trim()
    .replace(REGEX_REMOVE_QUOTES, '$2')
    .replace(REGEX_REMOVE_QUOTES, '$2'); // In case Some inputs have nested quotes like this "'word'"}
  return decode(cleanedName);
}

/**
 * Extracts name and email addresses from a string of emails.
 * @param {string} emails - String of emails to extract from.
 * @returns {Object[]} An array of objects containing the name and email address of each email.
 */
export function extractNameAndEmail(emails) {
  return emails
    .split(REGEX_HEADER_EMAIL_SPLIT_PATTERN)
    .map((emailString) => {
      if (emailString === undefined || emailString.trim() === '') {
        return null;
      }

      const match = emailString.match(REGEX_HEADER);

      if (!match) {
        return null;
      }

      const {
        name = '',
        address,
        identifier,
        domain,
        tld
      } = match.groups || {};
      const cleanedName = cleanName(name);
      const haveSimilarity =
        cleanedName.toLowerCase() !== address.toLowerCase();
      const nameToAdd = haveSimilarity ? cleanedName : '';
      return {
        name: nameToAdd,
        address: address.toLowerCase(),
        identifier,
        domain: `${domain}.${tld}`
      };
    })
    .filter((result) => result !== null);
}
