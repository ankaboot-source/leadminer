import { Tag } from '../../services/tagging/types';
import {
  NEWSLETTER_EMAIL_ADDRESS_INCLUDES,
  NOREPLY_EMAIL_ADDRESS_INCLUDES
} from '../constants';

/**
 * Returns the type type of the email address based on its domain type.
 * @param domainType - This is the type of domain, it can be either "provider" or "custom"
 * @returns the type of email address.
 */
export function findEmailAddressType(domainType: string) {
  switch (domainType) {
    case 'custom':
      return 'professional';
    case 'provider':
      return 'personal';
    default:
      return '';
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
 * Tags an email address.
 * @param email - The email to check.
 * @param email.address - The email address.
 * @param email.name - The user name.
 * @param domainType - The type of domain, it can be either "provider" or "custom"
 * @returns List of tags
 */
export function getEmailTags(
  { address, name }: { address: string; name: string },
  domainType: 'provider' | 'custom'
): Tag[] {
  const emailTags: Tag[] = [];

  const emailType = findEmailAddressType(domainType);

  if (isNoReply(address)) {
    emailTags.push({ name: 'no-reply', reachable: 0, source: 'refined' });
  }

  if (isNewsletter(address) || name?.includes('newsletter')) {
    emailTags.push({ name: 'newsletter', reachable: 2, source: 'refined' });
  }

  if (emailType !== '') {
    emailTags.push({
      name: emailType,
      reachable: 1,
      source: 'refined'
    });
  }

  return emailTags;
}
