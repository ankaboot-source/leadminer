import { REACHABILITY } from '../../../utils/constants';
import {
  findEmailAddressType,
  isChat,
  isGroup,
  isNewsletter,
  isNoReply,
  isRole,
  isTransactional
} from '../../../utils/helpers/taggingHelpers';
import {
  BasicTag,
  DomainType,
  HeaderTag,
  Tag,
  TagSource,
  TaggingEngine
} from '../types';

interface EmailAddress {
  address: string;
  name: string;
  domainType: DomainType;
}

interface Options {
  header: any;
  email: EmailAddress;
  field: string;
}

export default class EmailMessageTagging implements TaggingEngine {
  tags: Tag[];

  private readonly tagSourceFromEmailAddress: TagSource =
    'refined#email_address';

  private readonly tagSourceFromEmailHeader: TagSource =
    'refined#message_header';

  constructor(tags: Tag[]) {
    this.tags = tags;
  }

  getEmailAddressTags(email: {
    address: string;
    name: string;
    domainType: DomainType;
  }): BasicTag[] | null {
    const { address, name, domainType } = email;

    const emailTags = [];
    const emailType = findEmailAddressType(domainType);

    if (emailType === 'invalid') {
      return null;
    }

    if (isNoReply(address)) {
      return [
        {
          source: this.tagSourceFromEmailAddress,
          name: 'no-reply',
          reachable: REACHABILITY.NONE
        }
      ];
    }

    if (isTransactional(address)) {
      return [
        {
          source: this.tagSourceFromEmailAddress,
          name: 'transactional',
          reachable: REACHABILITY.NONE
        }
      ];
    }

    if (isNewsletter(address) || name?.includes('newsletter')) {
      return [
        {
          source: this.tagSourceFromEmailAddress,
          name: 'newsletter',
          reachable: REACHABILITY.UNSURE
        }
      ];
    }

    if (emailType === 'personal') {
      return [
        {
          source: this.tagSourceFromEmailAddress,
          name: emailType,
          reachable: REACHABILITY.DIRECT_PERSON
        }
      ];
    }

    if (emailType === 'professional') {
      emailTags.push({
        source: this.tagSourceFromEmailAddress,
        name: emailType,
        reachable: REACHABILITY.DIRECT_PERSON
      });
    }

    if (isRole(address)) {
      emailTags.push({
        source: this.tagSourceFromEmailAddress,
        name: 'role',
        reachable: REACHABILITY.UNSURE
      });
    }

    if (isChat(address)) {
      emailTags.push({
        source: this.tagSourceFromEmailAddress,
        name: 'chat',
        reachable: REACHABILITY.MANY_OR_INDIRECT_PERSON
      });
    }

    if (isGroup(address)) {
      emailTags.push({
        source: this.tagSourceFromEmailAddress,
        name: 'group',
        reachable: REACHABILITY.MANY_OR_INDIRECT_PERSON
      });
    }

    return emailTags.length > 0 ? emailTags : null;
  }

  getEmailMessageHeaderTags(header: any): HeaderTag[] {
    const tags: HeaderTag[] = [];

    for (const { rules, tag, prerequisiteConditions } of this.tags) {
      // If the email message was already tagged differently, transactional tag no longer applies
      if (tag.name === 'transactional' && tags.length > 0) {
        return tags;
      }

      if (prerequisiteConditions && prerequisiteConditions.length > 0) {
        const isMissingRequiredCondition = prerequisiteConditions.some(
          (c) => !c.checkCondition({ header })
        );

        if (isMissingRequiredCondition) {
          // eslint-disable-next-line no-continue
          continue;
        }
      }

      for (const { conditions, fields } of rules) {
        if (
          conditions.some((condition) => condition.checkCondition({ header }))
        ) {
          tags.push({ ...tag, source: this.tagSourceFromEmailHeader, fields });
          return tags;
        }
      }
    }

    return tags;
  }

  getTags({ header, email, field }: Options): BasicTag[] {
    let tags = this.getEmailAddressTags(email) ?? [];

    if (tags?.find((tag) => ['professional', 'role'].includes(tag.name))) {
      // Tag "role" may be a subset of the "newsletter" tag so it's eligible for additional tagging.
      const headerTags = this.getEmailMessageHeaderTags(header).filter(
        (t) => (t && t.fields === undefined) || t.fields.includes(field)
      );

      if (headerTags.length > 0) {
        // Remove all existing tags except for the "professional" tag.
        tags = tags.filter(({ name }) => name === 'professional');
        tags.push(...headerTags);
      }
    }

    const finalTags = tags.map(({ name, source, reachable }) => ({
      name,
      source,
      reachable
    }));

    return finalTags;
  }
}
