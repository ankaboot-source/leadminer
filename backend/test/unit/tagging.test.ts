import { describe, it, beforeEach, expect } from '@jest/globals';
import {
  groupEmailMessage,
  chatEmailMessage,
  newsletterEmailMessage,
  transactionalEmailMessage
} from '../../src/services/tagging/tags';
import EmailTaggingEngine from '../../src/services/tagging';
import HasHeaderField from '../../src/services/tagging/conditions/HasHeaderField';
import HasHeaderFieldStartsWith from '../../src/services/tagging/conditions/HasHeaderFieldStartsWith';
import HasHeaderWithValues from '../../src/services/tagging/conditions/HasHeaderFieldWithValues';
import HasNoHeaderField from '../../src/services/tagging/conditions/HasNoHeaderField';
import {
  CHAT_EMAIL_ADDRESS_INCLUDES,
  GROUP_EMAIL_ADDRESS_INCLUDES,
  NEWSLETTER_EMAIL_ADDRESS_INCLUDES,
  NOREPLY_EMAIL_ADDRESS_INCLUDES,
  ROLE_EMAIL_ADDRESS_INCLUDES,
  TRANSACTIONAL_EMAIL_ADDRESS_INCLUDES
} from '../../src/utils/constants';
import { BasicTag, DomainType, Tag } from '../../src/services/tagging/types';

/**
 * Helper function used to generate emails from a list of email parts.
 * @returns
 */
function generateEmails(emailParts: string[], domainType = 'custom') {
  const emails = emailParts.map((part) => {
    let address = `${part}@leadminer.io`;
    let domain = `${part}.io`;

    if (part.startsWith('@')) {
      address = `leadminer${part}.io`;
      domain = `${part}.io`;
    } else if (/\.[a-zA-Z]{2,18}$/.test(part)) {
      address = `leadminer${part}`;
      domain = part;
    } else if (part.endsWith('@')) {
      address = `${part}leadminer.io`;
      domain = `${part}.io`;
    }

    return {
      name: '',
      address,
      domain,
      domainType: domainType as DomainType
    };
  });

  return emails;
}
/**
 * Tests common logic for tag verification.
 * @param tagToTest - The tag to be tested.
 * @param expectedOutputTag - The expected output tag.
 */
function testTagsCommonLogic(tagToTest: Tag, expectedOutputTag: BasicTag) {
  const { rules, tag } = tagToTest;

  for (const { fields, conditions } of rules) {
    for (const condition of conditions) {
      if ('possibleHeaderFields' in condition) {
        (condition.possibleHeaderFields as string[]).forEach(
          (field: string) => {
            it(`Should tag as ${tag.name} if it has a "${field}" in the header`, () => {
              const emailHeader = { [field]: ['test'] };
              const tags =
                EmailTaggingEngine.getEmailMessageHeaderTags(emailHeader);

              expect(tags).toEqual([{ ...expectedOutputTag, fields }]);
            });
          }
        );
      }

      if ('possibleHeaderPrefixes' in condition) {
        (condition.possibleHeaderPrefixes as string[]).forEach((prefix) => {
          it(`Should tag as ${tag.name} if it has a header field with "${prefix}" as prefix`, () => {
            const emailHeader = { [`${prefix}-test`]: ['test'] };
            const tags =
              EmailTaggingEngine.getEmailMessageHeaderTags(emailHeader);

            expect(tags).toEqual([{ ...expectedOutputTag, fields }]);
          });
        });
      }

      if ('values' in condition) {
        const { values, field } = condition as unknown as {
          values: string[];
          field: string;
        };
        (values as string[]).forEach((value) => {
          it(`Should tag as ${tag.name} if it has an "${field}" field with "${value}" as value`, () => {
            const emailHeader = { [field]: [value] };
            const tags =
              EmailTaggingEngine.getEmailMessageHeaderTags(emailHeader);

            expect(tags).toEqual([{ ...expectedOutputTag, fields }]);
          });
        });
      }
    }
  }
}

describe('Tagging Conditions', () => {
  describe('conditions.HasHeaderField', () => {
    it('should return True if field is found', () => {
      const header = {
        test: ['test value']
      };
      const rule = new HasHeaderField(['test']);

      expect(rule.checkCondition({ header })).toBe(true);
    });

    it('should return False if field is not found', () => {
      const header = {
        'test-field': ['test value']
      };
      const rule = new HasHeaderField(['test']);

      expect(rule.checkCondition({ header })).toBe(false);
    });
  });

  describe('conditions.HasHeaderFieldStartsWith', () => {
    it('should return True if field is found', () => {
      const header = {
        'testid-test': ['test-value-1']
      };
      const rule = new HasHeaderFieldStartsWith(['testid']);

      expect(rule.checkCondition({ header })).toBe(true);
    });

    it('should return False if field is not found', () => {
      const header = {
        test: ['test-value']
      };
      const rule = new HasHeaderFieldStartsWith(['testid']);

      expect(rule.checkCondition({ header })).toBe(false);
    });
  });

  describe('conditions.HasHeaderWithValues', () => {
    it('should return True if field is found', () => {
      const header = {
        test: ['test-value-1']
      };
      const rule = new HasHeaderWithValues('test', ['test-value-1']);

      expect(rule.checkCondition({ header })).toBe(true);
    });

    it('should return False if field is found but wrong value', () => {
      const header = {
        test: ['test-value-2']
      };
      const rule = new HasHeaderWithValues('test', ['test-value-1']);

      expect(rule.checkCondition({ header })).toBe(false);
    });

    it('should return False if field is not found', () => {
      const header = {
        'test-field': ['test-value-1']
      };
      const rule = new HasHeaderWithValues('test', ['test-value-1']);

      expect(rule.checkCondition({ header })).toBe(false);
    });
  });

  describe('conditions.HasNoHeaderField', () => {
    it('should return False if field is found', () => {
      const header = {
        testid: ['test-value']
      };
      const rule = new HasNoHeaderField(['testid']);

      expect(rule.checkCondition({ header })).toBe(false);
    });

    it('should return True if field is not found', () => {
      const header = {
        test: ['test-value']
      };
      const rule = new HasNoHeaderField(['testing']);

      expect(rule.checkCondition({ header })).toBe(true);
    });
  });
});

describe('test engines.EmailTaggingEngine', () => {
  let header: Record<string, string[]> = {};

  beforeEach(() => {
    header = {
      'message-id': ['<test_message_id>'],
      subject: ['Test Subject'],
      to: ['test@example.com'],
      from: ['sender@example.com']
    };
  });

  describe('EmailTaggingEngine.getEmailMessageHeaderTags', () => {
    it('should return empty array if there are no tags', () => {
      const tags = EmailTaggingEngine.getEmailMessageHeaderTags(header);

      expect(tags).toHaveLength(0);
    });

    describe('Testing transactional email header tag', () => {
      const input: Tag = transactionalEmailMessage;
      const output: BasicTag = {
        source: 'refined#message_header',
        name: 'transactional',
        reachable: 0
      };

      testTagsCommonLogic(input, output);
    });

    describe('Testing newsletter email header tag', () => {
      const input: Tag = newsletterEmailMessage;
      const output: BasicTag = {
        source: 'refined#message_header',
        name: 'newsletter',
        reachable: 3
      };

      testTagsCommonLogic(input, output);

      it("shouldn't tag as newsletter if header has list-post", () => {
        header['list-post'] = ['test'];
        header['list-id'] = ['test'];

        const tags = EmailTaggingEngine.getEmailMessageHeaderTags(header);

        expect(tags).toEqual([
          {
            name: 'group',
            reachable: 2,
            source: 'refined#message_header',
            fields: ['list-post']
          }
        ]);
      });
    });

    describe('Testing group email header tag', () => {
      const input: Tag = groupEmailMessage;
      const output: BasicTag = {
        source: 'refined#message_header',
        name: 'group',
        reachable: 2
      };

      testTagsCommonLogic(input, output);
    });

    describe('Testing chat email header tag', () => {
      const input: Tag = chatEmailMessage;
      const output: BasicTag = {
        source: 'refined#message_header',
        name: 'chat',
        reachable: 2
      };

      testTagsCommonLogic(input, output);
    });
  });

  describe('EmailTaggingEngine.getEmailAddressTags', () => {
    describe('Testing no-reply email addresses tagging', () => {
      const expectedOutputTags: BasicTag[] = [
        {
          reachable: 0,
          name: 'no-reply',
          source: 'refined#email_address'
        }
      ];

      it('should correctly tag no-reply email addresses', () => {
        const emailsToTest = generateEmails(NOREPLY_EMAIL_ADDRESS_INCLUDES);
        const outputTags = emailsToTest.map((email) =>
          EmailTaggingEngine.getEmailAddressTags(email)
        );

        for (const tag of outputTags) {
          expect(tag).toEqual(expectedOutputTags);
        }
      });

      it('should correctly tag no-reply email addresses with emailType "personal"', () => {
        const emailsToTest = generateEmails(
          NOREPLY_EMAIL_ADDRESS_INCLUDES,
          'provider'
        );
        const outputTags = emailsToTest.map((email) =>
          EmailTaggingEngine.getEmailAddressTags(email)
        );

        for (const tag of outputTags) {
          expect(tag).toEqual(expectedOutputTags);
        }
      });
    });

    describe('Testing transactional email addresses tagging', () => {
      const emailsToTest = generateEmails(TRANSACTIONAL_EMAIL_ADDRESS_INCLUDES);
      const expectedOutputTags: BasicTag[] = [
        {
          reachable: 0,
          name: 'transactional',
          source: 'refined#email_address'
        }
      ];

      emailsToTest.forEach((email) => {
        const tag = expectedOutputTags.map(({ name }) => name).join(',');

        it(`should correctly tag "${email.address} as ${tag}`, () => {
          const tags = EmailTaggingEngine.getEmailAddressTags(email);

          expect(tags).toEqual(expectedOutputTags);
        });
      });
    });

    describe('Testing newsletter email addresses tagging', () => {
      const emailsToTest = generateEmails(NEWSLETTER_EMAIL_ADDRESS_INCLUDES);
      const expectedOutputTags: BasicTag[] = [
        {
          reachable: 3,
          name: 'newsletter',
          source: 'refined#email_address'
        }
      ];

      emailsToTest.forEach((email) => {
        const tag = expectedOutputTags.map(({ name }) => name).join(',');

        it(`should correctly tag "${email.address} as ${tag}`, () => {
          const tags = EmailTaggingEngine.getEmailAddressTags(email);

          expect(tags).toEqual(expectedOutputTags);
        });
      });
    });

    describe('Testing role email addresses tagging', () => {
      const emailsToTest = generateEmails(ROLE_EMAIL_ADDRESS_INCLUDES);
      const expectedOutputTags: BasicTag[] = [
        {
          reachable: 1,
          name: 'professional',
          source: 'refined#email_address'
        },
        {
          reachable: 2,
          name: 'role',
          source: 'refined#email_address'
        }
      ];

      emailsToTest.forEach((email) => {
        const tag = expectedOutputTags.map(({ name }) => name).join(',');

        it(`should correctly tag "${email.address} as ${tag}`, () => {
          const tags = EmailTaggingEngine.getEmailAddressTags(email);

          expect(tags).toEqual(expectedOutputTags);
        });
      });
    });

    describe('Testing chat email addresses tagging', () => {
      const emailsToTest = generateEmails(CHAT_EMAIL_ADDRESS_INCLUDES);
      const expectedOutputTags: BasicTag[] = [
        {
          reachable: 1,
          name: 'professional',
          source: 'refined#email_address'
        },
        {
          reachable: 2,
          name: 'chat',
          source: 'refined#email_address'
        }
      ];

      emailsToTest.forEach((email) => {
        const tag = expectedOutputTags.map(({ name }) => name).join(',');

        it(`should correctly tag "${email.address} as ${tag}`, () => {
          const tags = EmailTaggingEngine.getEmailAddressTags(email);

          expect(tags).toEqual(expectedOutputTags);
        });
      });
    });

    describe('Testing group email addresses tagging', () => {
      const emailsToTest = generateEmails(GROUP_EMAIL_ADDRESS_INCLUDES);
      const expectedOutputTags: BasicTag[] = [
        {
          reachable: 1,
          name: 'professional',
          source: 'refined#email_address'
        },
        {
          reachable: 2,
          name: 'group',
          source: 'refined#email_address'
        }
      ];

      emailsToTest.forEach((email) => {
        const tag = expectedOutputTags.map(({ name }) => name).join(',');

        it(`should correctly tag "${email.address} as ${tag}`, () => {
          const tags = EmailTaggingEngine.getEmailAddressTags(email);

          expect(tags).toEqual(expectedOutputTags);
        });
      });
    });
  });

  describe('EmailTaggingEngine.getTags', () => {
    it('should correctly combine header and email tags', () => {
      // will be tagged as group
      header['list-post'] = ['test'];

      // will be tagged as professional
      const email = {
        name: 'user',
        address: 'user@leadminer.io',
        domain: 'leadminer.io',
        domainType: 'custom' as DomainType
      };
      const expectedTags = [
        {
          reachable: 1,
          name: 'professional',
          source: 'refined#email_address'
        },
        {
          reachable: 2,
          name: 'group',
          source: 'refined#message_header'
        }
      ];
      const tags = EmailTaggingEngine.getTags({
        header,
        email,
        field: 'list-post'
      });

      expect(tags).toEqual(expectedTags);
    });

    it('should correctly filter email tags and add relevant header tags', () => {
      // will be tagged as group
      header['list-post'] = ['test'];

      // will be tagged as professional, role
      const email = {
        name: 'contact',
        address: 'contact@leadminer.io',
        domain: 'leadminer.io',
        domainType: 'custom' as DomainType
      };
      const expectedTags = [
        {
          reachable: 1,
          name: 'professional',
          source: 'refined#email_address'
        },
        {
          reachable: 2,
          name: 'group',
          source: 'refined#message_header'
        }
      ];
      const tags = EmailTaggingEngine.getTags({
        header,
        email,
        field: 'list-post'
      });

      expect(tags).toEqual(expectedTags);
    });

    it('should return only emailAddress-related tags ', () => {
      // will be tagged as professional, role
      const email = {
        name: 'contact',
        address: 'contact@leadminer.io',
        domain: 'leadminer.io',
        domainType: 'custom' as DomainType
      };
      const expectedTags = [
        {
          reachable: 1,
          name: 'professional',
          source: 'refined#email_address'
        },
        {
          reachable: 2,
          name: 'role',
          source: 'refined#email_address'
        }
      ];

      const tags = EmailTaggingEngine.getTags({
        header,
        email,
        field: 'list-post'
      });

      expect(tags).toEqual(expectedTags);
    });

    it('should correctly apply relevant tags based on email address and header informations', () => {
      // will be tagged as group with field list-post
      header['list-post'] = ['test'];

      // will be tagged as chat with field reply-to
      header['x-linkedin-class'] = ['inmail'];

      // will be tagged as professional
      const email = {
        name: 'user',
        address: 'user@leadminer.io',
        domain: 'leadminer.io',
        domainType: 'custom' as DomainType
      };
      const tagsFromReplyTo = EmailTaggingEngine.getTags({
        header,
        email,
        field: 'reply-to'
      });
      const tagsFromListPost = EmailTaggingEngine.getTags({
        header,
        email,
        field: 'list-post'
      });

      expect(tagsFromReplyTo).toEqual([
        {
          reachable: 1,
          name: 'professional',
          source: 'refined#email_address'
        },
        {
          reachable: 2,
          name: 'chat',
          source: 'refined#message_header'
        }
      ]);
      expect(tagsFromListPost).toEqual([
        {
          reachable: 1,
          name: 'professional',
          source: 'refined#email_address'
        }
      ]);
    });

    it('should tag transactional and no-reply emails with the correct tags', () => {
      const transactionalTag = EmailTaggingEngine.getTags({
        header,
        email: {
          name: '',
          address: 'updates@leadminer.io',
          domainType: 'custom' as DomainType
        },
        field: ''
      });

      const noReplyTag = EmailTaggingEngine.getTags({
        header,
        email: {
          name: '',
          address: 'no-reply@leadminer.io',
          domainType: 'custom' as DomainType
        },
        field: ''
      });
      const expectedTag = {
        reachable: 0,
        source: 'refined#email_address'
      };

      // Validate the transactional email tag
      expect(transactionalTag.length).toEqual(1);
      expect(transactionalTag).toEqual([
        {
          name: 'transactional',
          ...expectedTag
        }
      ]);

      // Validate the no-reply email tag
      expect(noReplyTag.length).toEqual(1);
      expect(noReplyTag).toEqual([
        {
          name: 'no-reply',
          ...expectedTag
        }
      ]);
    });

    it('should tag transactional message headers with the correct tags', () => {
      // set a transactional field
      header['feedback-id'] = [''];

      const transactionalTag = EmailTaggingEngine.getTags({
        header,
        email: {
          name: '',
          address: 'leadminer@leadminer.io',
          domainType: 'custom' as DomainType
        },
        field: 'from'
      });

      expect(transactionalTag.length).toEqual(2);
      expect(transactionalTag).toEqual([
        {
          name: 'professional',
          reachable: 1,
          source: 'refined#email_address'
        },
        {
          name: 'transactional',
          reachable: 0,
          source: 'refined#message_header'
        }
      ]);
    });
  });
});
