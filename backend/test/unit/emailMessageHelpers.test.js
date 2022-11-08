const { expect } = require('chai');

const emailMessageHelpers = require('../../app/utils/helpers/emailMessageHelpers');
const config = require('config'),
  NEWSLETTER_HEADER_FIELDS = config.get('email_types.newsletter').split(',').filter(n => n),
  TRANSACTIONAL_HEADER_FIELDS = config
    .get('email_types.transactional')
    .split(',').filter(n => n),
  MAILING_LIST_HEADER_FIELDS = config.get('email_types.list').split(',').filter(n => n);
  HEADER_FIELDS = [...NEWSLETTER_HEADER_FIELDS, ...TRANSACTIONAL_HEADER_FIELDS, ...MAILING_LIST_HEADER_FIELDS, "references"] 

const TEST_HEADERS = {
    'delivered-to': [ '' ],
    'received': ['',],
    'x-google-smtp-source': [''],
    'x-received': [''],
    'arc-seal': [''],
    'arc-message-signature': [''],
    'arc-authentication-results': [''],
    'return-path': ['',''],
    'received-spf': [''],
    'authentication-results': [''],
    'dkim-signature': [''],
    'x-hs-cid': [ '' ],
    'list-unsubscribe': [''],
    'date': [ '' ],
    'from': [ '' ],
    'reply-to': [ '' ],
    'to': [ '' ],
    'message-id': [''],
    'subject': [ '' ],
    'mime-version': [ '1.0' ],
    'content-type': [''],
    'precedence': [ 'bulk' ],
    'x-report-abuse-to': [''],
    'feedback-id': [ '' ]
  }

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

describe('emailMessageHepers.hasSpecificHeader', () => {
    
    it('Should return false when headers not present', () => {

        HEADER_FIELDS.forEach(
            (el) => {
                if (TEST_HEADERS[el])
                    delete TEST_HEADERS[el];
        })
        expect(emailMessageHelpers.hasSpecificHeader(TEST_HEADERS, HEADER_FIELDS)).to.be.false
    })

    HEADER_FIELDS.forEach(
        (el) => {
            it(`Should return true for header: ${el}`, () => {
                TEST_HEADERS[el] = ['']
                expect(emailMessageHelpers.hasSpecificHeader(TEST_HEADERS, [el])).to.be.true
                delete TEST_HEADERS[el]
            })
        }
    )
})