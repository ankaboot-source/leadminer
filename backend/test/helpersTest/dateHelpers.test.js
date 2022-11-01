const chai = require('chai'),
  expect = chai.expect;
const dateHelpers = require('../../app/utils/dateHelpers');
describe('dateHelpers.parseDate(date)', () => {
  it('should replace CEST by +0200 and return readable date', () => {
    let date = 'Fri, 28 Feb 2014 18:03:09 CEST';
    let expectedOuput = '2014-02-28 16:03';
    let output = dateHelpers.parseDate(date);
    expect(output).to.eql(expectedOuput);
  });
  it("should replace UTC-IP-ADDRESS(UTC-xxx-xxx-xx-xx) by '' and return readable date", () => {
    let date = 'Fri, 28 Feb 2014 18:03:09 UTC-0.0.0.0';
    let expectedOuput = '2014-02-28 17:03';
    let output = dateHelpers.parseDate(date);
    expect(output).to.eql(expectedOuput);
  });
});
describe('dateHelpers.compareDates(date1,date2)', () => {
  it('should return true (date1 is greater than date2)', () => {
    let output = dateHelpers.compareDates(
      '2014-02-28 16:03',
      '2014-02-28 16:01'
    );
    expect(output).to.eql(true);
  });
  it('should return false (date2 is greater)', () => {
    let output = dateHelpers.compareDates(
      '2014-02-28 16:03',
      '2014-02-30 20:50'
    );
    expect(output).to.eql(false);
  });
});
