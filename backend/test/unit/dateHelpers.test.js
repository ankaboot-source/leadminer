const { expect } = require('chai');
const dateHelpers = require('../../app/utils/helpers/dateHelpers');

describe('dateHelpers.parseDate(date)', function () {
  it('should replace CEST by +0200 and return readable date', function () {
    const date = 'Fri, 28 Feb 2014 18:03:09 CEST';
    const output = dateHelpers.parseDate(date);
    const expectedOutput = '2014-02-28 16:03';
    expect(output).to.eql(expectedOutput);
  });

  it("should replace UTC-IP-ADDRESS(UTC-xxx-xxx-xx-xx) by '' and return readable date", function () {
    const date = 'Fri, 28 Feb 2014 18:03:09 UTC-0.0.0.0';
    const expectedOutput = '2014-02-28 17:03';
    const output = dateHelpers.parseDate(date);
    expect(output).to.eql(expectedOutput);
  });
});

describe('dateHelpers.compareDates(date1,date2)', function () {
  it('should return true (date1 is greater than date2)', function () {
    const output = dateHelpers.compareDates(
      '2014-02-28 16:03',
      '2014-02-28 16:01'
    );
    expect(output).to.eql(true);
  });

  it('should return false (date2 is greater)', function () {
    const output = dateHelpers.compareDates(
      '2014-02-28 16:03',
      '2014-02-30 20:50'
    );
    expect(output).to.eql(false);
  });
});
