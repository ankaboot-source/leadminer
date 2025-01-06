import { decode } from 'html-entities';
import { decode as _decode } from 'quoted-printable';
import {
  REGEX_BODY,
  REGEX_CLEAN_NAME_FROM_UNWANTED_WORDS,
  REGEX_HEADER,
  REGEX_HEADER_EMAIL_SPLIT_PATTERN,
  REGEX_REMOVE_QUOTES
} from '../../utils/constants';
import { RegexContact } from './types';

/**
 * Returns the extracted name from a space-separated name email input.
 * @param name - The input from which the name is extracted.
 * @returns The extracted name, or an empty string if no name is found.
 */
export function cleanName(name: string) {
  const cleanedName = decode(name)
    .trim()
    .replace(/\\"/g, '')
    .replace(REGEX_REMOVE_QUOTES, '$2')
    .replace(REGEX_REMOVE_QUOTES, '$2') // In case Some inputs have nested quotes like this "'word'"}
    .replace(/[,;]+$/, '') // Remove trailing ; and , to not cause errors later when exporting to csv
    .replace(/^[,;]+/, '') // Remove trailing ; and , to not cause errors later when exporting to csv
    .replace(REGEX_CLEAN_NAME_FROM_UNWANTED_WORDS, ''); // Remove the word "via" and text after it

  return cleanedName;
}

/**
 * Extracts name and email addresses from a string of emails.
 * @param emails - String of emails to extract from.
 */
export function extractNameAndEmail(emails: string): RegexContact[] {
  const result = [];

  for (const emailStr of emails.split(REGEX_HEADER_EMAIL_SPLIT_PATTERN)) {
    if (emailStr.trim() === '') {
      continue;
    }

    // For emails with format <mailto:email@example.com> found in List-Post headers
    const cleanEmailStr = emailStr.startsWith('<mailto:')
      ? emailStr.replace('<mailto:', '')
      : emailStr;
    const match = cleanEmailStr.match(REGEX_HEADER);

    if (!match) {
      continue;
    }

    const {
      name = undefined,
      address = undefined,
      plusAddress = undefined,
      identifier,
      domain,
      tld
    } = match.groups || {};

    if (!address) {
      continue;
    }

    const cleanedName = name && cleanName(name);
    const finalName =
      cleanedName?.toLowerCase() !== address.toLowerCase()
        ? cleanedName
        : undefined;

    const finalTld = tld.toLocaleLowerCase();
    const finalDomain = `${domain.toLocaleLowerCase()}.${finalTld}`;
    const finalIdentifier = identifier.toLocaleLowerCase();
    const finalPlusAddress = plusAddress?.toLocaleLowerCase();

    result.push({
      identifier: finalIdentifier,
      name: finalName,
      domain: finalDomain,
      address: `${finalIdentifier}@${finalDomain}`,
      plusAddress: finalPlusAddress
        ? `${finalIdentifier}${finalPlusAddress}@${finalDomain}`
        : undefined
    });
  }

  return result;
}

/**
 * Extracts names and emails from the email body.
 * @param data The email body data.
 * @returns An array of objects containing the extracted name and email details.
 */
export function extractNameAndEmailFromBody(data: string): RegexContact[] {
  const decodedData = _decode(data);
  const matches = Array.from(decodedData.matchAll(REGEX_BODY));

  if (!matches || matches.length === 0) {
    return [];
  }

  const result = matches.map((match) => {
    const { address, identifier, domain, tld } = match.groups || {};

    return {
      address,
      identifier,
      domain: `${domain}.${tld}`
    };
  });

  return result;
}
