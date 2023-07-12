import { describe, expect, it, jest } from '@jest/globals';
import { TaggingEngine } from '../../src/services/tagging/types';
import EmailMessage from '../../src/services/extractors/EmailMessage';
// import { beforeEach } from '@jest/globals';
// import { groupEmailMessage, linkedinEmailMessage, transactionalEmailMessage } from '../../src/services/tagging/tags';

jest.mock('../../src/config', () => ({
  LEADMINER_API_LOG_LEVEL: 'error'
}));

const taggingEngine = {} as TaggingEngine;

describe('Email Message', () => {
  describe('references', () => {
    it('should return an empty array if no references are present in the header', () => {
      const message = new EmailMessage(
        taggingEngine,
        {},
        '',
        { 'message-id': 'test' },
        {},
        'folder'
      );
      expect(message.references).toEqual([]);
    });

    it('should return an array of references if they are present in the header', () => {
      const message = new EmailMessage(
        taggingEngine,
        {},
        '',
        { 'message-id': 'test', references: ['<r1>'] },
        {},
        'folder'
      );

      expect(message.references).toEqual(['<r1>']);
    });

    it('should handle spaces between references', () => {
      const message = new EmailMessage(
        taggingEngine,
        {},
        '',
        { 'message-id': 'test', references: ['<r1> <r2> <r3>'] },
        {},
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
        const message = new EmailMessage(
          taggingEngine,
          {},
          '',
          {
            'message-id': 'test',
            'list-post': [''],
            'list-id': [listIdHeaderField]
          },
          {},
          ''
        );

        expect(message.listId).toBe(CORRECT_LIST_IDS[index]);
      });
    });

    TEST_INPUTS_SHOULD_FAIL.forEach((testInput) => {
      it(`Should return empty string for falsy list-id value = ${
        testInput === '' ? 'empty-string' : testInput
      }`, () => {
        const message = new EmailMessage(
          taggingEngine,
          {},
          '',

          {
            'message-id': 'test',
            'list-post': [''],
            'list-id': [testInput]
          },
          {},
          ''
        );
        expect(message.listId).toBe('');
      });
    });

    it('Should return empty string in the absence of list-post header field', () => {
      const message = new EmailMessage(
        taggingEngine,
        {},
        '',
        {
          'message-id': 'test',
          'list-id': ['']
        },
        {},
        ''
      );

      expect(message.listId).toBe('');
    });

    it('Should return empty string in the absence of list-id header field', () => {
      const message = new EmailMessage(
        taggingEngine,
        {},
        '',
        {
          'message-id': 'test',
          'list-post': ['']
        },
        {},
        ''
      );

      expect(message.listId).toBe('');
    });
  });

  describe('date', () => {
    it('should return the date in UTC format if date is present and valid', () => {
      const date = new Date().toUTCString();
      const message = new EmailMessage(
        taggingEngine,
        {},
        '',
        {
          'message-id': 'test',
          date: [`${date}`]
        },
        {},
        ''
      );

      expect(message.date).toBe(date);
    });

    it('should return "UNKOWN" if the date is not present in the header', () => {
      const message = new EmailMessage(
        taggingEngine,
        {},
        '',
        {
          'message-id': 'test'
        },
        {},
        ''
      );

      expect(message.date).toEqual('UNKOWN');
    });

    it('should return "UNKOWN" if the date is not a valid date', () => {
      const message = new EmailMessage(
        taggingEngine,
        {},
        '',
        {
          'message-id': 'test',
          date: ['not a date']
        },
        {},
        ''
      );

      expect(message.date).toEqual('UNKOWN');
    });
  });

  describe('messageId', () => {
    it('should return the message-id field if it is present in the header', () => {
      const message = new EmailMessage(
        taggingEngine,
        {},
        '',
        {
          'message-id': ['<test_message_id>'],
          subject: ['Test Subject'],
          to: ['test@example.com'],
          from: ['sender@example.com']
        },
        {},
        ''
      );

      expect(message.messageId).toBe('<test_message_id>');
    });
  });
});
