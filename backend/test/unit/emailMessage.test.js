const { expect } = require('chai');

const EmailMessage = require('../../app/services/EmailMessage')

describe('EmailMessage.getDate()', function () {
    it('should return the date in UTC format if date is present and valid', function () {
        const date = new Date()
        const header = { date: [date.toString()] };
        const message = new EmailMessage('email@email.com', 1, header)
        expect(message.getDate()).to.equal(date.toUTCString());
    });

    it('should return null if the date is not present in the header', function () {
        const header = {};
        const message = new EmailMessage('email@email.com', 1, header)
        expect(message.getDate()).to.be.null;
    });

    it('should return null if the date is not a valid date', function () {
        const header = { date: ['not a date'] };
        const message = new EmailMessage('email@email.com', 1, header)
        expect(message.getDate()).to.be.null;
    });
});