const { expect } = require('chai');

const EmailMessage = require('../../app/services/EmailMessage')
const {
    newsletterHeaders,
    transactionalHeaders,
    mailingListHeaders
} = require('../../app/config/emailHeaders.config')

const NEWS_LETTER_HEADERS = newsletterHeaders
const TRANSACTIONAL_HEADERS = transactionalHeaders
const MAILING_LIST_HEADERS = mailingListHeaders

describe('EmailMessage.isList()', () => {

    let message = ''

    beforeEach(() => {
        message = new EmailMessage({}, '', 1, {})
    })

    MAILING_LIST_HEADERS.forEach((headerField) => {
        it(`Should return true if ${headerField} exists in header`, () => {
            message.header[headerField] = ['']
            expect(message.isList()).to.be.true
        })
    })

    it('Should return true if any mailing list fields exists in header', () => {
        MAILING_LIST_HEADERS.forEach((headerField) => { message.header[headerField] = [''] })
        expect(message.isList()).to.be.true
    })

    it('Should return false if no mailing list field exists in header', () => {
        expect(message.isList()).to.be.false
    })
})


describe('EmailMessage.isNewletter()', () => {

    let message = ''

    beforeEach(() => {
        message = new EmailMessage({}, '', 1, {})
    })

    NEWS_LETTER_HEADERS.forEach((headerField) => {
        it(`Should return true if ${headerField} exists in header`, () => {
            message.header[headerField] = ['']
            expect(message.isNewsletter()).to.be.true
        })
    })

    it('Should return true if any news-letter fields exists in header', () => {
        NEWS_LETTER_HEADERS.forEach((headerField) => { message.header[headerField] = [''] })
        expect(message.isNewsletter()).to.be.true
    })

    it('Should return false if no news letter field exists in header', () => {
        expect(message.isNewsletter()).to.be.false
    })
})

describe('EmailMessage.isTransactional()', () => {

    let message = ''

    beforeEach(() => {
        message = new EmailMessage({}, '', 1, {})
    })

    TRANSACTIONAL_HEADERS.forEach((headerField) => {
        it(`Should return true if ${headerField} exists in header`, () => {
            message.header[headerField] = ['']
            expect(message.isTransactional()).to.be.true
        })
    })

    it('Should return true if any transactional fields exists in header', () => {
        TRANSACTIONAL_HEADERS.forEach((headerField) => { message.header[headerField] = [''] })
        expect(message.isTransactional()).to.be.true
    })

    it('Should return false if no transactional field exists in header', () => {
        expect(message.isTransactional()).to.be.false
    })
})

describe('EmailMessage.getReferences()', () => {

    let message = ''

    beforeEach(() => {
        message = new EmailMessage({}, '', 1, {})
    })

    it('should return an empty array if no references are present in the header', () => {
        message.header = {};
        expect(message.getReferences()).to.deep.equal([]);
    });

    it('should return an array of references if they are present in the header', () => {
        message.header = { references: ['<r1>'] };
        expect(message.getReferences()).to.deep.equal(['<r1>']);
    });

    it('should handle spaces between references', () => {
        message.header = { references: ['<r1> <r2> <r3>'] };
        expect(message.getReferences()).to.deep.equal(['<r1>', '<r2>', '<r3>']);
    });
});

describe('EmailMessage.getListId()', () => {

    let message = ''

    const LIST_ID_FORMAT_RFC = [
        "List Header Mailing List <list-header.nisto.com>",
        "<commonspace-users.list-id.within.com>",
        "\"Lena's Personal Joke List \" <lenas-jokes.da39efc25c530ad145d41b86f7420c3b.021999.localhost>",
        "\"An internal CMU List\" <0Jks9449.list-id.cmu.edu>",
        "<da39efc25c530ad145d41b86f7420c3b.052000.localhost>"
    ]
    const CORRECT_LIST_IDS = [
        "<list-header.nisto.com>",
        "<commonspace-users.list-id.within.com>",
        "<lenas-jokes.da39efc25c530ad145d41b86f7420c3b.021999.localhost>",
        "<0Jks9449.list-id.cmu.edu>",
        "<da39efc25c530ad145d41b86f7420c3b.052000.localhost>"
    ]
    const TEST_INPUTS_SHOULD_FAIL = ['Text ithout list-id', '"Text" ithout list-id', '']

    beforeEach(() => {
        message = new EmailMessage({}, '', 1, {})
    });

    LIST_ID_FORMAT_RFC.forEach((listIdHeaderField, index) => {
        it(`Should return <listID>:string for list-id header fields = ${listIdHeaderField}`, () => {

            message.header = {
                'list-post': [''],
                'list-id': [listIdHeaderField]
            }
            expect(message.getListId()).to.equal(CORRECT_LIST_IDS[index]);
        });
    });

    TEST_INPUTS_SHOULD_FAIL.forEach((testInput) => {
        it(`Should return empty string for falsy list-id value = ${testInput === '' ? 'empty-string' : testInput}`, () => {
            message.header = {
                'list-post': [''],
                'list-id': [testInput]
            }
            expect(message.getListId()).to.equal('');
        })
    })

    it('Should return empty string in the absence of list-post header field', () => {
        message.header = {
            'list-id': [''],
        }
        expect(message.getListId()).to.equal('');
    });

    it('Should return empty string in the absence of list-id header field', () => {
        message.header = {
            'list-post': [''],
        }
        expect(message.getListId()).to.equal('');
    });
});

describe('EmailMessage.getDate()', () => {

    let message = ''

    beforeEach(() => {
        message = new EmailMessage({}, '', 1, {})
    })

    it('should return the date in UTC format if date is present and valid', () => {
        const date = new Date()
        message.header = { date: [date.toString()] };
        expect(message.getDate()).to.equal(date.toUTCString());
    });

    it('should return null if the date is not present in the header', () => {
        expect(message.getDate()).to.be.null;
    });

    it('should return null if the date is not a valid date', () => {
        message.header = { date: ['not a date'] };
        expect(message.getDate()).to.be.null;
    });
});

describe('EmailMessage.getMessagingFieldsFromHeader()', () => {

    let message = ''

    beforeEach(() => {
        message = new EmailMessage({}, '', 1, {});
    });

    it('should return an empty object if no messaging fields are present in the header', () => {
        message.header = {};
        expect(message.getMessagingFieldsFromHeader()).to.deep.equal({});
    });

    it('should return an object with messaging fields if they are present in the header', () => {
        message.header = {
            to: ['test@example.com'],
            from: ['sender@example.com'],
            cc: ['cc@example.com'],
            bcc: ['bcc@example.com']
        };
        expect(message.getMessagingFieldsFromHeader()).to.deep.equal({
            to: 'test@example.com',
            from: 'sender@example.com',
            bcc: "bcc@example.com",
            cc: "cc@example.com"
        });
    });

    it('should return an object with messaging fields if they are present in the header', () => {
        message.header = {
            subject: ['Test Subject'],
            to: ['test@example.com'],
            from: ['sender@example.com']
        };
        expect(message.getMessagingFieldsFromHeader()).to.deep.equal({
            to: 'test@example.com',
            from: 'sender@example.com'
        });
    });
});


describe('EmailMessage.getMessageId()', () => {

    let message = ''

    beforeEach(() => {
        message = new EmailMessage({}, '', 1, {});
    });

    it('should return `message_id_unknown` if the message-id field is not present in the header', () => {
        message.header = { date: ['01-01-2021'] };
        expect(message.getMessageId()).to.equal('message_id_unknown 01-01-2021');
    });

    it('should return the message-id field if it is present in the header', () => {
        message.header = {
            'message-id': ['<test_message_id>'],
            date: ['01-01-2021']
        };
        expect(message.getMessageId()).to.equal('<test_message_id>');
    });
});


describe('EmailMessage.getTagsField()', () => {

    let message = ''

    beforeEach(() => {
        message = new EmailMessage({}, '', 1, {});
    })

    it('should return tags for transactional, list, newsletter', () => {

        message.isNewsletter = () => true;
        message.isTransactional = () => true;
        message.isList = () => true;

        const result = message.getTagsField('from')
        expect(result).to.be.an('array')
        expect(result).to.deep.equal([
            { name: 'newsletter', reachable: 2, source: 'refined' },
            { name: 'transactional', reachable: 2, source: 'refined' },
            { name: 'list', reachable: 2, source: 'refined' }
        ])
    })

    it('should return an empty array if there is no tags', () => {
        const result = message.getTagsField('from')
        expect(result).to.be.an('array')
        expect(result).to.deep.equal([])
    })

    it('should return an empty array if field is not equal to "from"', () => {
        const result = message.getTagsField('cc')
        expect(result).to.be.an('array')
        expect(result).to.deep.equal([])
    })
})

describe('EmailMessage.getTags()', () => {

    let message = ''

    beforeEach(() => {
        message = new EmailMessage({}, '', 1, {});
    })

    it('should return tags for transactional, list, newsletter, no-reply, personal', () => {

        message.isNewsletter = () => true;
        message.isTransactional = () => true;
        message.isList = () => true;

        const result = message.getTags('from', { address: 'support@leadminer.com' }, 'personal')
        expect(result).to.be.an('array')
        expect(result).to.deep.equal([
            { name: 'newsletter', reachable: 2, source: 'refined' },
            { name: 'transactional', reachable: 2, source: 'refined' },
            { name: 'list', reachable: 2, source: 'refined' },
            { name: 'no-reply', reachable: 0, source: 'refined' },
            { name: 'personal', reachable: 1, source: 'refined' }
        ])
    })

    it('should return no-reply, personal tags when field not equal "from"', () => {
        const result = message.getTags('', { address: 'support@leadminer.com' }, 'personal')
        expect(result).to.be.an('array')
        expect(result).to.deep.equal([
            { name: 'no-reply', reachable: 0, source: 'refined' },
            { name: 'personal', reachable: 1, source: 'refined' }
        ])
    });

    it('should return an empty array if there is no tags', () => {
        const result = message.getTags('', { address: 'leadminer@leadminer.com' }, '')
        expect(result).to.be.an('array')
        expect(result).to.deep.equal([])
    });
})

describe('EmailMessage.constructPersonPocTags()', () => {

    const email = {
        address: 'test@example.com',
        identifier: 'test_identifier',
        name: 'Test Name'
    };

    it('should return a person object with the correct properties when fieldName is "from"', () => {
        const result = EmailMessage.constructPersonPocTags(email, [], 'from');
        expect(result).to.have.property('person');
        expect(result.person).to.have.property('name', 'Test Name');
        expect(result.person).to.have.property('email', 'test@example.com');
        expect(result.person).to.have.property('identifiers').that.deep.equals(['test_identifier']);
    });

    it('should return a pointOfContact object with the correct properties when fieldName is "to"', () => {
        const result = EmailMessage.constructPersonPocTags(email, [], 'to');
        expect(result).to.have.property('pointOfContact');
        expect(result.pointOfContact).to.have.property('name', 'Test Name');
        expect(result.pointOfContact).to.have.property('_to', true);
        expect(result.pointOfContact).to.have.property('_from', false);
    });

    it('should return a tags array', () => {
        const tags = [{ name: 'test', label: 'test label', reachable: 2, type: 'test type' }];
        const result = EmailMessage.constructPersonPocTags(email, tags, 'from');
        expect(result).to.have.property('tags').that.deep.equals(tags);
    });
});
