const { expect } = require('chai');

const EmailMessage = require('../../app/services/EmailMessage')

describe('EmailMessage.getDate()', () => {
    it('should return the date in UTC format if date is present and valid', () => {
        const date = new Date()
        const header = { date: [date.toString()] };
        const message = new EmailMessage({},'', 1, header)
        expect(message.getDate()).to.equal(date.toUTCString());
    });

    it('should return null if the date is not present in the header', () => {
        const header = {};
        const message = new EmailMessage({},'', 1, header)
        expect(message.getDate()).to.be.null;
    });

    it('should return null if the date is not a valid date', () => {
        const header = { date: ['not a date'] };
        const message = new EmailMessage({},'', 1, header)
        expect(message.getDate()).to.be.null;
    });
});

describe('EmailMessage.getListId()', () => {

    const TEST_HEADERS = {
        'list-post': [''],
        'list-id': [''],
        'invalid-header': ['']
    }
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


    LIST_ID_FORMAT_RFC.forEach((listIdHeaderField, index) => {
        it(`Should return <listID>:string for list-id header fields = ${listIdHeaderField}`, () => {
            TEST_HEADERS['list-id'] = [listIdHeaderField]
            const message = new EmailMessage({},'', 1, TEST_HEADERS)
            expect(message.getListId()).to.equal(CORRECT_LIST_IDS[index]);
        });
    });

    for (const testInput of TEST_INPUTS_SHOULD_FAIL) {
        it(`Should return empty string for falsy list-id value = ${testInput === '' ? 'empty-string' : testInput}`, () => {
            TEST_HEADERS['list-id'] = [testInput]
            const message = new EmailMessage({},'', 1, TEST_HEADERS)
            expect(message.getListId()).to.equal('');
        })
    }

    it('Should return empty string in the absence of list-post header field', () => {
        delete TEST_HEADERS['list-post']
        const message = new EmailMessage({},'', 1, TEST_HEADERS)
        expect(message.getListId()).to.equal('');
    });

    it('Should return empty string in the absence of list-id header field', () => {
        delete TEST_HEADERS['list-post']
        TEST_HEADERS['list-post'] = ['']
        const message = new EmailMessage({}, '', 1, TEST_HEADERS)
        expect(message.getListId()).to.equal('');
    });
});

describe('EmailMessage.isList()', () => {

    const TEST_HEADERS = {
        'list-post': ['']
    }

    it('Should return true if "list-post" field exists in header', () => {
        const message = new EmailMessage({}, '', 1, TEST_HEADERS)
        expect(message.isList()).to.be.true

    })

    it('Should return false if "list-post" field does not exist in header', () => {
        delete TEST_HEADERS['list-post']
        const message = new EmailMessage({}, '', 1, TEST_HEADERS)
        expect(message.isList()).to.be.false
    })

})
