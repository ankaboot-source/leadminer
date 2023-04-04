const { expect } = require('chai');

const emailMessageHelpers = require('../../app/utils/helpers/emailMessageHelpers');

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
    'received-spf': [''],
    'authentication-results': [''],
    'dkim-signature': [''],
    'x-hs-cid': [''],
    'list-unsubscribe': [''],
    date: [''],
    from: [''],
    'reply-to': [''],
    to: [''],
    'message-id': [''],
    subject: [''],
    'mime-version': ['1.0'],
    'content-type': [''],
    precedence: ['bulk'],
    'x-report-abuse-to': [''],
    'feedback-id': ['']
  };

  it('Should return null when headers not present', () => {
    expect(
      emailMessageHelpers.getSpecificHeader(TEST_HEADERS, [
        'x-missing',
        'x-missing-2'
      ])
    ).to.be.null;
  });

  Object.keys(TEST_HEADERS).forEach((key) => {
    it(`Should return value for existing header: ${key}`, () => {
      TEST_HEADERS[key] = ['testing'];
      expect(
        emailMessageHelpers.getSpecificHeader(TEST_HEADERS, [key])[0]
      ).to.equal('testing');
    });
  });
});

describe('emailMessageHelpers.getMessageId', () => {
  it('should return the message ID if it exists in the parsed header', () => {
    const parsedHeader = {
      'message-id': ['12345'],
      'return-path': ['test@example.com'],
      date: ['2022-01-01']
    };
    const messageId = emailMessageHelpers.getMessageId(parsedHeader);
    expect(messageId).to.equal('12345');
  });

  it('should generate a pseudo message ID if the parsed header does not have one', () => {
    const parsedHeader = {
      'return-path': ['test@example.com'],
      date: ['2022-01-01']
    };
    const messageId = emailMessageHelpers.getMessageId(parsedHeader);
    expect(messageId).to.match(/^UNKNOWN \d+@example\.com$/);
  });
});
