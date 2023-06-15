import { Tag, EmailMessageContent, TaggingStratetgy } from '../types';
import {
  isNoReply,
  isTransactional,
  isNewsletter
} from '../../../utils/helpers/emailAddressHelpers';

export class EmailTagging implements TaggingStratetgy {
  tags: Tag[];

  constructor(tags: Tag[]) {
    this.tags = tags;
  }

  getEmailType(domainType: string) {
    switch (domainType) {
      case 'custom':
        return 'professional';
      case 'provider':
        return 'personal';
      default:
        return null;
    }
  }

  emailAddressTags(address: string, emailDomainType: string) {
    const emailType = this.getEmailType(emailDomainType);

    if (emailType === 'personal') {
      return {
        name: 'personal',
        reachable: 1,
        source: 'refined'
      };
    }

    if (isNoReply(address)) {
      return { name: 'no-reply', reachable: 0, source: 'refined' };
    }

    if (isTransactional(address)) {
      return {
        name: 'transactional',
        reachable: 0,
        source: 'refined'
      };
    }

    if (isNewsletter(address)) {
      return { name: 'newsletter', reachable: 2, source: 'refined' };
    }

    if (emailType === 'professional') {
      return {
        name: 'professional',
        reachable: 1,
        source: 'refined'
      };
    }

    return null;
  }

  extractTags({
    header,
    emailAddress,
    emailDomainType,
    emailFoundIn
  }: EmailMessageContent) {
    let currentTag = null;

    if (emailAddress && emailDomainType) {
      // Try extracting tags from the email address itself
      currentTag = this.emailAddressTags(emailAddress, emailDomainType);
    }

    // If email type is personaln no need to extra tagging
    if (currentTag && currentTag.name !== 'professional') {
      return currentTag;
    }

    console.log(currentTag);

    for (const { rules, name, reachable } of this.tags) {
      const hasMetCondition = rules.some((condition) =>
        condition.checkCondition({
          header,
          emailAddress,
          emailDomainType,
          emailFoundIn
        })
      );

      if (hasMetCondition) {
        return { ...{ name, reachable }, source: 'refined' };
      }
    }

    return currentTag;
  }
}
