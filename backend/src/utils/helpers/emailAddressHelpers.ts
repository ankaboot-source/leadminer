import { DomainType, Tag } from '../../services/tagging/types';
import {
  AIRBNB_EMAIL_ADDRESS_INCLUDES,
  REACHABILITY,
  GROUP_EMAIL_ADDRESS_INCLUDES,
  LINKEDIN_EMAIL_ADDRESS_INCLUDES,
  NEWSLETTER_EMAIL_ADDRESS_INCLUDES,
  NOREPLY_EMAIL_ADDRESS_INCLUDES,
  ROLE_EMAIL_ADDRESS_INCLUDES,
  TRANSACTIONAL_EMAIL_ADDRESS_INCLUDES
} from '../constants';

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
 * Checks if an email address can be tagged as airbnb
 * @param emailAddress - The email address to check.
 * @returns Returns true if the email can be tagged as airbnb, false otherwise.
 */
export function isAirbnb(emailAddress: string) {
  return AIRBNB_EMAIL_ADDRESS_INCLUDES.some((word) =>
    emailAddress.toLowerCase().includes(word)
  );
}

/**
 * Checks if an email address can be tagged as linkedin
 * @param emailAddress - The email address to check.
 * @returns true if the email can be tagged as linkedin, false otherwise.
 */
export function isLinkedin(emailAddress: string) {
  return LINKEDIN_EMAIL_ADDRESS_INCLUDES.some((word) =>
    emailAddress.toLowerCase().includes(word)
  );
}

/**
 * Retrieves a single tag for an email address based on its properties.
 *
 * @param address - The email address.
 * @param name - The name associated with the email address.
 * @param domainType - The type of domain the email address belongs to.
 * @returns A tag for the email address, or null if no tag is found.
 */
export function getEmailTag(
  { address, name }: { address: string; name: string },
  domainType: DomainType
): Tag[] | null {
  const tagSource = 'refined#email_address';
  const emailType = findEmailAddressType(domainType);
  const emailTags: Tag[] = [];

  if (emailType === 'invalid') {
    return null;
  }

  if (emailType === 'personal') {
    return [
      {
        name: emailType,
        reachable: REACHABILITY.DIRECT_PERSON,
        source: tagSource
      }
    ];
  }

  if (isNoReply(address)) {
    return [
      {
        name: 'no-reply',
        reachable: REACHABILITY.NONE,
        source: tagSource
      }
    ];
  }

  if (isTransactional(address)) {
    return [
      {
        name: 'transactional',
        reachable: REACHABILITY.NONE,
        source: tagSource
      }
    ];
  }

  if (emailType === 'professional') {
    emailTags.push({
      name: emailType,
      reachable: REACHABILITY.DIRECT_PERSON,
      source: tagSource
    });
  }

  if (isNewsletter(address) || name?.includes('newsletter')) {
    emailTags.push({
      name: 'newsletter',
      reachable: REACHABILITY.UNSURE,
      source: tagSource
    });
  }

  if (isAirbnb(address)) {
    emailTags.push({
      name: 'airbnb',
      reachable: REACHABILITY.INDIRECT_PERSON,
      source: tagSource
    });
  }

  if (isRole(address)) {
    emailTags.push({
      name: 'role',
      reachable: REACHABILITY.UNSURE,
      source: tagSource
    });
  }

  if (isLinkedin(address)) {
    emailTags.push({
      name: 'linkedin',
      reachable: REACHABILITY.INDIRECT_PERSON,
      source: tagSource
    });
  }

  if (isGroup(address)) {
    emailTags.push({
      name: 'group',
      reachable: REACHABILITY.MANY,
      source: tagSource
    });
  }

  return emailTags.length > 0 ? emailTags : null;
}
