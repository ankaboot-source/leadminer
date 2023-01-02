const { expect } = require('chai');

const emailMessageHelpers = require('../../app/utils/helpers/emailMessageHelpers');
const {
  newsletterHeaders,
  transactionalHeaders,
  mailingListHeaders
} = require('../../app/config/emailHeaders.config');

const HEADER_FIELDS = [
  ...newsletterHeaders,
  ...transactionalHeaders,
  ...mailingListHeaders,
  'references'
];
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

describe('emailMessageHelpers.isNoReply(emailAddress)', () => {
  it('should return true for no-reply-leadminer@leadminer.io', () => {
    const output = emailMessageHelpers.isNoReply(
      'no-reply-leadminer@leadminer.io'
    );
    expect(output).to.be.true;
  });

  it('should return false for leadminer@leadminer.io', () => {
    const output = emailMessageHelpers.isNoReply('leadminer@leadminer.com');
    expect(output).to.be.false;
  });
});

describe('emailMessageHepers.getSpecificHeader', () => {
  it('Should return null when headers not present', () => {
    HEADER_FIELDS.forEach((el) => {
      if (TEST_HEADERS[el]) delete TEST_HEADERS[el];
    });
    expect(emailMessageHelpers.getSpecificHeader(TEST_HEADERS, HEADER_FIELDS))
      .to.be.null;
  });

  HEADER_FIELDS.forEach((el) => {
    it(`Should return value for header: ${el}`, () => {
      TEST_HEADERS[el] = ['testing'];
      expect(emailMessageHelpers.getSpecificHeader(TEST_HEADERS, [el])[0]).to.equal('testing')
      delete TEST_HEADERS[el];
    });
  });
});
