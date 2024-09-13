import { describe, expect, it, jest } from '@jest/globals';
import { getMessageId } from '../../src/utils/helpers/emailHeaderHelpers';

jest.mock('../../src/config', () => {});

describe('EmailMessage.helpers.getMessageId', () => {
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
