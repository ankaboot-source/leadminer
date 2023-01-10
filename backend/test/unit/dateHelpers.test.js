const { expect } = require('chai');
const { parseDate } = require('../../app/utils/helpers/dateHelpers');

describe('dateHelpers.parseDate', () => {
  it('should parse the valid date string and return the date and time parts of the ISO format string', () => {
    const validDate = 'Mon, 02 Jan 2021 14:30:00 +0000';
    const expected = '2021-01-02 14:30';
    expect(parseDate(validDate)).to.equal(expected);
  });

  it('should parse the date string with a different timezone and return the date and time parts of the ISO format string', () => {
    const validDate = 'Mon, 02 Jan 2021 14:30:00 GMT';
    const expected = '2021-01-02 14:30';
    expect(parseDate(validDate)).to.equal(expected);
  });

  it('should return null when the date string is not valid', () => {
    const invalidDate = 'not a valid date string';
    expect(parseDate(invalidDate)).to.be.null;
  });
});
