import { DomainType } from '../../services/tagging/types';
import {
  CHAT_EMAIL_ADDRESS_INCLUDES,
  GROUP_EMAIL_ADDRESS_INCLUDES,
  NEWSLETTER_EMAIL_ADDRESS_INCLUDES,
  NOREPLY_EMAIL_ADDRESS_INCLUDES,
  ROLE_EMAIL_ADDRESS_INCLUDES,
  TRANSACTIONAL_EMAIL_ADDRESS_INCLUDES
} from '../constants';
import { getSpecificHeader } from './emailHeaderHelpers';

/**
 * Checks if a particular header field has a value from a given list of possible values
 * @param header - Header object.
 * @param headerField - A header key.
 * @param headerValues - A list of possible header values.
 * @returns
 */
export function hasHeaderWithValue(
  header: any,
  headerField: string,
  headerValues: string[]
) {
  const headerValue = getSpecificHeader(header, [headerField]);

  if (!headerValue) {
    return false;
  }

  return headerValues.some((value) =>
    headerValue[0].toLocaleLowerCase().includes(value)
  );
}

/**
 * Checks if a particular header field starts with one of the prefixes
 * @param header - Header object.
 * @param prefixes - A list of possible header key prefixes.
 * @returns
 */
export function hasHeaderFieldStartsWith(header: any, prefixes: string[]) {
  const headerFields = Object.keys(header);
  return headerFields.some((field) =>
    prefixes.some((prefix) => field.toLowerCase().startsWith(prefix))
  );
}

/**
 * Returns the type type of the email address based on its domain type.
 * @param domainType - This is the type of domain, it can be either "provider" or "custom"
 * @returns the type of email address.
 */
export function findEmailAddressType(domainType: DomainType) {
  switch (domainType) {
    case 'custom':
      return 'professional';
    case 'provider':
      return 'personal';
    default:
      return 'invalid';
  }
}

/**
 * Checks if an email address can be tagged as no reply
 * @param emailAddress - The email address to check
 * @returns
 */
export function isNoReply(emailAddress: string) {
  return NOREPLY_EMAIL_ADDRESS_INCLUDES.some((word) =>
    emailAddress.toLowerCase().includes(word)
  );
}

/**
 * Checks if an email address can be tagged as no transactional
 * @param emailAddress - The email address to check
 * @returns
 */
export function isTransactional(emailAddress: string) {
  return TRANSACTIONAL_EMAIL_ADDRESS_INCLUDES.some((word) =>
    emailAddress.toLowerCase().includes(word)
  );
}

/**
 * Checks if an email address can be tagged as newsletter
 * @param emailAddress - The email address to check.
 * @returns
 */
export function isNewsletter(emailAddress: string) {
  return NEWSLETTER_EMAIL_ADDRESS_INCLUDES.some((word) =>
    emailAddress.toLowerCase().includes(word)
  );
}

/**
 * Checks if an email address can be tagged as group
 * @param emailAddress - The email address to check.
 * @returns
 */
export function isGroup(emailAddress: string) {
  return GROUP_EMAIL_ADDRESS_INCLUDES.some((word) =>
    emailAddress.toLowerCase().includes(word)
  );
}

/**
 * Checks if an email address can be tagged as role
 * @param emailAddress - The email address to check.
 * @returns Returns true if the email can be tagged as role, false otherwise.
 */
export function isRole(emailAddress: string) {
  return ROLE_EMAIL_ADDRESS_INCLUDES.some((word) =>
    emailAddress.toLowerCase().includes(word)
  );
}

/**
 * Checks if an email address can be tagged as chat
 * @param emailAddress - The email address to check.
 * @returns true if the email can be tagged as chat, false otherwise.
 */
export function isChat(emailAddress: string) {
  return CHAT_EMAIL_ADDRESS_INCLUDES.some((word) =>
    emailAddress.toLowerCase().includes(word)
  );
}
