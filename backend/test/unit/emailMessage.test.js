const { expect } = require('chai');

const EmailMessage = require('../../app/services/EmailMessage')

describe('EmailMessage.getDate(date)', () => {

    it('should return the parsed date if the date property is valid', () => {
        const header = { date: ['Mon, 02 Jan 2021 14:30:00 +0000'] };
        const expected = '2021-01-02 14:30';
        const message = new EmailMessage('email@email.com', 1, header)
        expect(message.getDate()).to.equal(expected);
    });

    it('should return the original date if the date property is not valid', () => {
        const header = { date: ['not a valid date string'] };
        const message = new EmailMessage('email@email.com', 1, header)
        const parsedDate = message.getDate()
        expect(parsedDate).to.not.be.null
        expect(parsedDate[0]).to.equal('not a valid date string');
    });

    it('should return null if the date property is not present', () => {
        const header = {};
        const message = new EmailMessage('email@email.com', 1, header)
        expect(message.getDate()).to.be.null;
    });
});