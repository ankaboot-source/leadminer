const { expect } = require('chai');
const {
  EMAIL_HEADERS_NEWSLETTER,
  EMAIL_HEADERS_TRANSACTIONAL,
  EMAIL_HEADERS_MAILING_LIST
} = require('../../app/utils/constants');

const emailMessageHelpers = require('../../app/utils/helpers/emailMessageHelpers');

const HEADER_FIELDS = [
  ...EMAIL_HEADERS_NEWSLETTER,
  ...EMAIL_HEADERS_TRANSACTIONAL,
  ...EMAIL_HEADERS_MAILING_LIST,
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
      expect(
        emailMessageHelpers.getSpecificHeader(TEST_HEADERS, [el])[0]
      ).to.equal('testing');
      delete TEST_HEADERS[el];
    });
  });
});
