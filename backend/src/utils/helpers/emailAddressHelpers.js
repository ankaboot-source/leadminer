import {
  NEWSLETTER_EMAIL_ADDRESS_INCLUDES,
  NOREPLY_EMAIL_ADDRESS_INCLUDES
} from '../constants';

/**
 * Returns the type type of the email address based on its domain type.
 * @param {String} domainType - This is the type of domain, it can be either "provider" or "custom"
 * @returns the type of email address.
 */
export function findEmailAddressType(domainType) {
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
 * @returns {Boolean}
 */
export function isNoReply(emailAddress) {
  return NOREPLY_EMAIL_ADDRESS_INCLUDES.some((word) =>
    emailAddress.toLowerCase().includes(word)
  );
}

/**
 * Checks if an email address can be tagged as newsletter
 * @param emailAddress - The email address to check.
 * @returns {Boolean}
 */
export function isNewsletter(emailAddress) {
  return NEWSLETTER_EMAIL_ADDRESS_INCLUDES.some((word) =>
    emailAddress.toLowerCase().includes(word)
  );
}

/**
 * Tags an email address.
 * @param {Object} email - The email to check.
 * @param {string} email.address - The email address.
 * @param {string} email.name - The user name.
 * @param {string} domainType - The type of domain, it can be either "provider" or "custom"
 * @returns {Object[]} List of tags
 */
export function getEmailTags({ address, name }, domainType) {
  const emailTags = [];

  const emailType = findEmailAddressType(domainType);

  if (isNoReply(address)) {
    emailTags.push({ name: 'no-reply', reachable: 0, source: 'refined' });
  }

  if (isNewsletter(address) || (name && name.includes('newsletter'))) {
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
