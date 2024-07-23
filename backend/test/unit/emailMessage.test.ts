import { describe, expect, it, jest } from '@jest/globals';
import RedisMock from 'ioredis-mock';
import RedisCatchAllDomainsCache from '../../src/services/cache/redis/RedisCatchAllDomainsCache';
import RedisEmailStatusCache from '../../src/services/cache/redis/RedisEmailStatusCache';
import EmailMessage from '../../src/services/extractors/EmailMessage';
import { DomainStatusVerificationFunction } from '../../src/services/extractors/types';
import { BasicTag, TaggingEngine } from '../../src/services/tagging/types';

jest.mock('../../src/config', () => ({
  LEADMINER_API_LOG_LEVEL: 'error'
}));

jest.mock('ioredis', () => jest.requireActual('ioredis-mock'));

const taggingEngine: TaggingEngine = {
  tags: [],
  getTags: jest.fn(({ email }: { email: { address: string } }) => {
    const tags: BasicTag[] = [];
    if (email.address.startsWith('invalid')) {
      tags.push({
        name: 'transactional',
        source: 'refined#message_header',
        reachable: 3
      });
      tags.push({
        name: 'no-reply',
        source: 'refined#email_address',
        reachable: 3
      });
    } else {
      tags.push({
        name: 'professional',
        source: 'refined#email_address',
        reachable: 1
      });
    }

    return tags;
  })
};

const domainStatusVerification = jest.fn(() => [
  true,
  'custom'
]) as unknown as DomainStatusVerificationFunction;

const redis = new RedisMock();
const mockEmailStatusCache = new RedisEmailStatusCache(redis);
const mockAllCatchDomainsCache = new RedisCatchAllDomainsCache(redis);

describe('Email Message', () => {
  describe('references', () => {
    it('should return undefined if no references are present in the header', () => {
      const header = { 'message-id': 'test' };
      const message = new EmailMessage(
        taggingEngine,
        redis,
        mockEmailStatusCache,
        mockAllCatchDomainsCache,
        domainStatusVerification,
        'userEmail@example.com',
        'userid-1',
        header,
        'body',
        'folder'
      );
      expect(message.references).toBeUndefined();
    });

    it('should return an array of references if they are present in the header', () => {
      const header = { 'message-id': 'test', references: ['<r1>'] };
      const message = new EmailMessage(
        taggingEngine,
        redis,
        mockEmailStatusCache,
        mockAllCatchDomainsCache,
        domainStatusVerification,
        'userEmail@example.com',
        'userid-1',
        header,
        'body',
        'folder'
      );

      expect(message.references).toEqual(['<r1>']);
    });

    it('should handle spaces between references', () => {
      const header = { 'message-id': 'test', references: ['<r1> <r2> <r3>'] };
      const message = new EmailMessage(
        taggingEngine,
        redis,
        mockEmailStatusCache,
        mockAllCatchDomainsCache,
        domainStatusVerification,
        'userEmail@example.com',
        'userid-1',
        header,
        'body',
        'folder'
      );
      expect(message.references).toEqual(['<r1>', '<r2>', '<r3>']);
    });
  });

  describe('listId', () => {
    const LIST_ID_FORMAT_RFC = [
      'List Header Mailing List <list-header.nisto.com>',
      '<commonspace-users.list-id.within.com>',
      '"Lena\'s Personal Joke List " <lenas-jokes.da39efc25c530ad145d41b86f7420c3b.021999.localhost>',
      '"An internal CMU List" <0Jks9449.list-id.cmu.edu>',
      '<da39efc25c530ad145d41b86f7420c3b.052000.localhost>'
    ];
    const CORRECT_LIST_IDS = [
      '<list-header.nisto.com>',
      '<commonspace-users.list-id.within.com>',
      '<lenas-jokes.da39efc25c530ad145d41b86f7420c3b.021999.localhost>',
      '<0Jks9449.list-id.cmu.edu>',
      '<da39efc25c530ad145d41b86f7420c3b.052000.localhost>'
    ];
    const TEST_INPUTS_SHOULD_FAIL = [
      'Text ithout list-id',
      '"Text" ithout list-id',
      ''
    ];

    LIST_ID_FORMAT_RFC.forEach((listIdHeaderField, index) => {
      it(`Should return <listID>:string for list-id header fields = ${listIdHeaderField}`, () => {
        const header = {
          'message-id': 'test',
          'list-post': [''],
          'list-id': [listIdHeaderField]
        };
        const message = new EmailMessage(
          taggingEngine,
          redis,
          mockEmailStatusCache,
          mockAllCatchDomainsCache,
          domainStatusVerification,
          'userEmail@example.com',
          'userid-1',
          header,
          'body',
          ''
        );

        expect(message.listId).toBe(CORRECT_LIST_IDS[index]);
      });
    });

    TEST_INPUTS_SHOULD_FAIL.forEach((testInput) => {
      it(`Should return undefined for falsy list-id value = ${
        testInput === '' ? 'empty-string' : testInput
      }`, () => {
        const header = {
          'message-id': 'test',
          'list-post': [''],
          'list-id': [testInput]
        };
        const message = new EmailMessage(
          taggingEngine,
          redis,
          mockEmailStatusCache,
          mockAllCatchDomainsCache,
          domainStatusVerification,
          'userEmail@example.com',
          'userid-1',
          header,
          'body',
          ''
        );
        expect(message.listId).toBeUndefined();
      });
    });

    it('Should return undefined in the absence of list-post header field', () => {
      const header = {
        'message-id': 'test',
        'list-id': ['']
      };
      const message = new EmailMessage(
        taggingEngine,
        redis,
        mockEmailStatusCache,
        mockAllCatchDomainsCache,
        domainStatusVerification,
        'userEmail@example.com',
        'userid-1',
        header,
        'body',
        ''
      );

      expect(message.listId).toBeUndefined();
    });

    it('Should return undefined in the absence of list-id header field', () => {
      const header = {
        'message-id': 'test',
        'list-post': ['']
      };
      const message = new EmailMessage(
        taggingEngine,
        redis,
        mockEmailStatusCache,
        mockAllCatchDomainsCache,
        domainStatusVerification,
        'userEmail@example.com',
        'userid-1',
        header,
        'body',
        ''
      );

      expect(message.listId).toBeUndefined();
    });
  });

  describe('date', () => {
    it('should return the date in UTC format if date is present and valid', () => {
      const date = new Date().toUTCString();
      const header = {
        'message-id': 'test',
        date: [`${date}`]
      };
      const message = new EmailMessage(
        taggingEngine,
        redis,
        mockEmailStatusCache,
        mockAllCatchDomainsCache,
        domainStatusVerification,
        'userEmail@example.com',
        'userid-1',
        header,
        'body',
        ''
      );

      expect(message.date).toBe(date);
    });

    it('should return undefined if the date is not present in the header', () => {
      const header = {
        'message-id': 'test'
      };
      const message = new EmailMessage(
        taggingEngine,
        redis,
        mockEmailStatusCache,
        mockAllCatchDomainsCache,
        domainStatusVerification,
        'userEmail@example.com',
        'userid-1',
        header,
        'body',
        ''
      );

      expect(message.date).toBeUndefined();
    });

    it('should return undefined if the date is not a valid date', () => {
      const header = {
        'message-id': 'test',
        date: ['not a date']
      };
      const message = new EmailMessage(
        taggingEngine,
        redis,
        mockEmailStatusCache,
        mockAllCatchDomainsCache,
        domainStatusVerification,
        'userEmail@example.com',
        'userid-1',
        header,
        'body',
        ''
      );

      expect(message.date).toBeUndefined();
    });
  });

  describe('messageId', () => {
    it('should return the message-id field if it is present in the header', () => {
      const header = {
        'message-id': ['<test_message_id>'],
        subject: ['Test Subject'],
        to: ['test@example.com'],
        from: ['sender@example.com']
      };
      const message = new EmailMessage(
        taggingEngine,
        redis,
        mockEmailStatusCache,
        mockAllCatchDomainsCache,
        domainStatusVerification,
        'userEmail@example.com',
        'userid-1',
        header,
        'body',
        ''
      );

      expect(message.messageId).toBe('<test_message_id>');
    });
  });

  describe('getContacts', () => {
    it('should return only valid contacts', async () => {
      const header = {
        'message-id': ['test'],
        from: ['Leadminer <leadminer@leadminer.io>, test invalid@leadminer.io']
      };
      const message = new EmailMessage(
        taggingEngine,
        redis,
        mockEmailStatusCache,
        mockAllCatchDomainsCache,
        domainStatusVerification,
        'miningSource@leadminer.io',
        '',
        header,
        'body',
        ''
      );
      const expectedContacts = [
        {
          person: {
            name: 'Leadminer',
            email: 'leadminer@leadminer.io',
            identifiers: ['leadminer'],
            source: 'miningSource@leadminer.io'
          },
          pointOfContact: {
            name: 'Leadminer',
            to: false,
            cc: false,
            bcc: false,
            body: false,
            from: true,
            replyTo: false
          },
          tags: [
            {
              name: 'professional',
              source: 'refined#email_address',
              reachable: 1
            }
          ]
        }
      ];
      const contacts = await message.getContacts();
      expect(contacts.persons).toEqual(expectedContacts);
    });
  });
});
