import { REACHABILITY } from '../../../utils/constants';
import {
  findEmailAddressType,
  isAirbnb,
  isGroup,
  isLinkedin,
  isNewsletter,
  isNoReply,
  isRole,
  isTransactional
} from '../../../utils/helpers/taggingHelpers';
import { BasicTag, HeaderTag, Tag, TagSource, TaggingEngine } from '../types';

interface EmailAddress {
  address: string;
  name: string;
  domainType: any;
}

interface Options {
  header: any;
  email: EmailAddress;
  field: string;
}

export default class EmailMessageTagging implements TaggingEngine {
  tags: Tag[];

  constructor(tags: Tag[]) {
    this.tags = tags;
  }

  static getEmailAddressTags(email: {
    address: string;
    name: string;
    domainType: any;
  }): BasicTag[] | null {
    const { address, name, domainType } = email;

    const source: TagSource = 'refined#email_address';
    const emailTags = [];
    const emailType = findEmailAddressType(domainType);

    if (emailType === 'invalid') {
      return null;
    }

    if (emailType === 'personal') {
      return [
        {
          source,
          name: emailType,
          reachable: REACHABILITY.DIRECT_PERSON
        }
      ];
    }

    if (isNoReply(address)) {
      return [
        {
          source,
          name: 'no-reply',
          reachable: REACHABILITY.NONE
        }
      ];
    }

    if (isTransactional(address)) {
      return [
        {
          source,
          name: 'transactional',
          reachable: REACHABILITY.NONE
        }
      ];
    }

    if (isNewsletter(address) || name?.includes('newsletter')) {
      return [
        {
          source,
          name: 'newsletter',
          reachable: REACHABILITY.UNSURE
        }
      ];
    }

    if (emailType === 'professional') {
      emailTags.push({
        source,
        name: emailType,
        reachable: REACHABILITY.DIRECT_PERSON
      });
    }

    if (isAirbnb(address)) {
      emailTags.push({
        source,
        name: 'airbnb',
        reachable: REACHABILITY.INDIRECT_PERSON
      });
    }

    if (isRole(address)) {
      emailTags.push({
        source,
        name: 'role',
        reachable: REACHABILITY.UNSURE
      });
    }

    if (isLinkedin(address)) {
      emailTags.push({
        source,
        name: 'linkedin',
        reachable: REACHABILITY.INDIRECT_PERSON
      });
    }

    if (isGroup(address)) {
      emailTags.push({
        source,
        name: 'group',
        reachable: REACHABILITY.MANY
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
          (c: any) => !c.checkCondition({ header })
        );

        if (isMissingRequiredCondition) {
          // eslint-disable-next-line no-continue
          continue;
        }
      }

      for (const { conditions, fields } of rules) {
        if (
          conditions.some((condition: any) =>
            condition.checkCondition({ header })
          )
        ) {
          tags.push({ ...tag, source: 'refined#message_header', fields });
          return tags;
        }
      }
    }

    return tags;
  }

  getTags({ header, email, field }: Options): BasicTag[] {
    let tags = EmailMessageTagging.getEmailAddressTags(email) ?? [];

    if (tags?.find((tag: any) => ['professional', 'role'].includes(tag.name))) {
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
