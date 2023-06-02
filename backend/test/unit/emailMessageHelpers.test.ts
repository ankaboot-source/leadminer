import { describe, expect, it, jest } from '@jest/globals';
import {
  getMessageId,
  getSpecificHeader
} from '../../src/utils/helpers/emailMessageHelpers';

jest.mock('../../src/config', () => {});

describe('emailMessageHelpers.getSpecificHeader', () => {
  const TEST_HEADERS = {
    'delivered-to': [''],
    received: [''],
    'x-google-smtp-source': [''],
    'x-received': [''],
    'arc-seal': [''],
    'arc-message-signature': [''],
    'arc-authentication-results': [''],
    'return-path': ['', ''],
    'received-spf': ['']
  };

  it('Should return null when headers not present', () => {
    expect(
      getSpecificHeader(TEST_HEADERS, ['x-missing', 'x-missing-2'])
    ).toBeNull();
  });

  it('Should return value for existing header', () => {
    const header = {
      'delivered-to': 'testing',
      received: 'testing',
      'x-google-smtp-source': 'testing',
      'x-received': 'testing',
      'arc-seal': 'testing',
      'arc-message-signature': 'testing',
      'arc-authentication-results': 'testing',
      'return-path': 'testing',
      'received-spf': 'testing'
    };

    expect(getSpecificHeader(header, ['received-spf'])).toBe('testing');
    expect(getSpecificHeader(header, ['arc-seal'])).toBe('testing');
  });
});

describe('emailMessageHelpers.getMessageId', () => {
  it('should return the message ID if it exists in the parsed header', () => {
    const parsedHeader = {
      'message-id': ['12345'],
      'return-path': ['test@example.com'],
      date: ['2022-01-01']
    };
    const messageId = getMessageId(parsedHeader);
    expect(messageId).toBe('12345');
  });

  it('should generate a pseudo message ID if the parsed header does not have one', () => {
    const parsedHeader = {
      'return-path': ['test@example.com'],
      date: ['2022-01-01']
    };
    const messageId = getMessageId(parsedHeader);
    expect(messageId).toMatch(/^UNKNOWN \d+@example\.com$/);
  });

  it('should generate a pseudo message ID if the parsed header and return-path does not exist', () => {
    const parsedHeader = {
      date: ['2022-01-01']
    };
    const messageId = getMessageId(parsedHeader);
    expect(messageId).toMatch(/^UNKNOWN \d+@NO-RETURN-PATH$/);
  });
});
