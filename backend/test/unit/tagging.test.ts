import { describe, it, beforeEach, expect } from '@jest/globals';
import {
  groupEmailMessage,
  linkedinEmailMessage,
  newsletterEmailMessage,
  transactionalEmailMessage
} from '../../src/services/tagging/tags';
import EmailTaggingEngine from '../../src/services/tagging';
import HasHeaderField from '../../src/services/tagging/conditions/HasHeaderField';
import HasHeaderFieldStartsWith from '../../src/services/tagging/conditions/HasHeaderFieldStartsWith';
import HasHeaderWithValues from '../../src/services/tagging/conditions/HasHeaderFieldWithValues';
import HasNoHeaderField from '../../src/services/tagging/conditions/HasNoHeaderField';
import {
  AIRBNB_EMAIL_ADDRESS_INCLUDES,
  GROUP_EMAIL_ADDRESS_INCLUDES,
  LINKEDIN_EMAIL_ADDRESS_INCLUDES,
  NEWSLETTER_EMAIL_ADDRESS_INCLUDES,
  NOREPLY_EMAIL_ADDRESS_INCLUDES,
  ROLE_EMAIL_ADDRESS_INCLUDES,
  TRANSACTIONAL_EMAIL_ADDRESS_INCLUDES
} from '../../src/utils/constants';
import { DomainType } from '../../src/services/tagging/types';

/**
 * Helper function used to generate emails from a list of email parts.
 * @returns
 */
function generateEmails(emailParts: string[]) {
  const emails = emailParts.map((part) => {
    if (part.startsWith('@')) {
      return {
        name: '',
        address: `leadminer${part}.io`,
        domain: `${part}.io`,
        domainType: 'custom' as DomainType
      };
    }

    if (part.endsWith('@')) {
      return {
        name: '',
        address: `${part}leadminer.io`,
        domain: `${part}.io`,
        domainType: 'custom' as DomainType
      };
    }

    return {
      name: '',
      address: `${part}@leadminer.io`,
      domain: `${part}.io`,
      domainType: 'custom' as DomainType
    };
  });

  return emails;
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
    const testCase = [
      {
        input: transactionalEmailMessage,
        output: {
          source: 'refined#message_header',
          name: 'transactional',
          reachable: 0
        }
      },
      {
        input: newsletterEmailMessage,
        output: {
          source: 'refined#message_header',
          name: 'newsletter',
          reachable: 3
        }
      },
      {
        input: groupEmailMessage,
        output: {
          source: 'refined#message_header',
          name: 'group',
          reachable: 2
        }
      },
      {
        input: linkedinEmailMessage,
        output: {
          source: 'refined#message_header',
          name: 'linkedin',
          reachable: 2
        }
      }
    ];

    // Check that all registred tags work well
    for (const { input, output } of testCase) {
      const { rules, tag } = input;

      for (const { fields, conditions } of rules) {
        for (const condition of conditions) {
          if ('possibleHeaderFields' in condition) {
            (condition.possibleHeaderFields as string[]).forEach(
              (field: string) => {
                it(`Should tag as ${tag.name} if it has a "${field}" in the header`, () => {
                  const emailHeader = { [field]: ['test'] };
                  const tags =
                    EmailTaggingEngine.getEmailMessageHeaderTags(emailHeader);

                  expect(tags).toEqual([{ ...output, fields }]);
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

                expect(tags).toEqual([{ ...output, fields }]);
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

                expect(tags).toEqual([{ ...output, fields }]);
              });
            });
          }
        }
      }
    }

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

    it('should return empty array if there are no tags', () => {
      const tags = EmailTaggingEngine.getEmailMessageHeaderTags(header);

      expect(tags).toHaveLength(0);
    });
  });

  describe('EmailTaggingEngine.getEmailAddressTags', () => {
    const testCases = [
      {
        input: generateEmails(NOREPLY_EMAIL_ADDRESS_INCLUDES),
        output: [
          {
            reachable: 0,
            name: 'no-reply',
            source: 'refined#email_address'
          }
        ]
      },
      {
        input: generateEmails(TRANSACTIONAL_EMAIL_ADDRESS_INCLUDES),
        output: [
          {
            reachable: 0,
            name: 'transactional',
            source: 'refined#email_address'
          }
        ]
      },
      {
        input: generateEmails(NEWSLETTER_EMAIL_ADDRESS_INCLUDES),
        output: [
          {
            reachable: 3,
            name: 'newsletter',
            source: 'refined#email_address'
          }
        ]
      },
      {
        input: generateEmails(ROLE_EMAIL_ADDRESS_INCLUDES),
        output: [
          {
            reachable: 1,
            name: 'professional',
            source: 'refined#email_address'
          },
          {
            reachable: 3,
            name: 'role',
            source: 'refined#email_address'
          }
        ]
      },
      {
        input: generateEmails(LINKEDIN_EMAIL_ADDRESS_INCLUDES),
        output: [
          {
            reachable: 1,
            name: 'professional',
            source: 'refined#email_address'
          },
          {
            reachable: 2,
            name: 'linkedin',
            source: 'refined#email_address'
          }
        ]
      },
      {
        input: generateEmails(AIRBNB_EMAIL_ADDRESS_INCLUDES),
        output: [
          {
            reachable: 1,
            name: 'professional',
            source: 'refined#email_address'
          },
          {
            reachable: 2,
            name: 'airbnb',
            source: 'refined#email_address'
          }
        ]
      },
      {
        input: generateEmails(GROUP_EMAIL_ADDRESS_INCLUDES),
        output: [
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
        ]
      }
    ];

    // test all registred tags work well
    for (const { input: emails, output: expectedTags } of testCases) {
      emails.forEach((email) => {
        const tag = expectedTags.map(({ name }) => name).join(',');

        it(`should correctly tag "${email.address} as ${tag}`, () => {
          const tags = EmailTaggingEngine.getEmailAddressTags(email);

          expect(tags).toEqual(expectedTags);
        });
      });
    }
  });

  describe('EmailTaggingEngine.getTags', () => {
    it('should return header and email tags', () => {
      header['list-post'] = ['test']; // will be tagged as group
      const email = {
        // will be tagged as professional
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

    it('should correctly filter email tags and add header tags', () => {
      header['list-post'] = ['test']; // will be tagged as group
      const email = {
        // will be tagged as professional, role
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

    it('should return only email tags', () => {
      const email = {
        // will be tagged as professional, role
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
          reachable: 3,
          name: 'role',
          source: 'refined#email_address'
        }
      ];
      const tags = EmailTaggingEngine.getTags({ header, email, field: '' });

      expect(tags).toEqual(expectedTags);
    });

    it('should correctly filter tags to the supplied field', () => {
      header['list-post'] = ['test']; // will be tagged as group with field list-post
      header['x-linkedin-class'] = ['inmail']; // will be tagged as linkedin with field reply-to
      const email = {
        // will be tagged as professional
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
          name: 'linkedin',
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
  });
});
