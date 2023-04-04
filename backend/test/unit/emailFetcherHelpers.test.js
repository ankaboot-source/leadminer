const { expect } = require('chai');
const { getMessageId } = require('../../app/utils/helpers/emailFetcherHelpers');

describe('getMessageId', () => {
  it('should return the message ID if it exists in the parsed header', () => {
    const parsedHeader = {
      'message-id': ['12345'],
      'return-path': ['test@example.com'],
      date: ['2022-01-01'],
    };
    const messageId = getMessageId(parsedHeader);
    expect(messageId).to.equal('12345');
  });

  it('should generate a pseudo message ID if the parsed header does not have one', () => {
    const parsedHeader = {
      'return-path': ['test@example.com'],
      date: ['2022-01-01'],
    };
    const messageId = getMessageId(parsedHeader);
    expect(messageId).to.match(/^UNKNOWN \d+@example\.com$/);
  });

  it('should set the generated message ID in the parsed header', () => {
    const parsedHeader = {
      'return-path': ['test@example.com'],
      date: ['2022-01-01'],
    };
    const messageId = getMessageId(parsedHeader);
    expect(parsedHeader['message-id'][0]).to.equal(messageId);
  });
});