const { expect } = require('chai');

const emailMessageHelpers = require('../../app/utils/helpers/emailMessageHelpers');
const EmailMessage = require("../../app/services/EmailMessage")

const config = require('config'),
  NEWSLETTER_HEADER_FIELDS = config.get('email_types.newsletter').split(',').filter(n => n),
  TRANSACTIONAL_HEADER_FIELDS = config
    .get('email_types.transactional')
    .split(',').filter(n => n),
  MAILING_LIST_HEADER_FIELDS = config.get('email_types.list').split(',').filter(n => n);

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

const Email = new EmailMessage('', TEST_HEADERS, '', '', '')

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

describe('EmailMessage.isNewsletter', () => {
    
    it('Should return false when headers not present', () => {

        NEWSLETTER_HEADER_FIELDS.forEach(
            (el) => {
                if (Email.header[el])
                    delete Email.header[el];
        })
        expect(Email.isNewsletter()).to.be.false
    })

    NEWSLETTER_HEADER_FIELDS.forEach(
        (el) => {
            it('Should return true for header: ' + el, () => {
                Email.header[el] = ['']
                expect(Email.isNewsletter()).to.be.true
                delete Email.header[el]
            })
        }
    )
})

describe('EmailMessage.isTransactional', () => {

    it('Should return false when headers not present', () => {

        TRANSACTIONAL_HEADER_FIELDS.forEach(
            (el) => {
                if (Email.header[el])
                    delete Email.header[el];
        })
        expect(Email.isTransactional()).to.be.false
    })

    TRANSACTIONAL_HEADER_FIELDS.forEach(
        (el) => {
            it('Should return true for header: ' + el, () => {
                Email.header[el] = ['']
                expect(Email.isTransactional()).to.be.true
                delete Email.header[el]
            })
        }
    )
})

describe('EmailMessage.isList', () => {

    it('Should return false when headers not present', () => {

        MAILING_LIST_HEADER_FIELDS.forEach(
            (el) => {
                if (Email.header[el])
                    delete Email.header[el];
        })
        expect(Email.isList()).to.be.false
    })

    MAILING_LIST_HEADER_FIELDS.forEach(
        (el) => {
            it('Should return true for header: ' + el, () => {
                Email.header[el] = ['']
                expect(Email.isList()).to.be.true
                delete Email.header[el]
            })
        }
    )
})

describe('EmailMessage.isInConversation', () => {

    it('Should return 0 when key "references" is not present', () => {
        if (Email.header.references)
            delete Email.header.references
        expect(Email.isInConversation()).equal(0)
    })

    it('Should return 1 if key "references" is present', () => {
        Email.header.references = ['']
        expect(Email.isInConversation()).equal(1)
        delete Email.header.references
    })
})