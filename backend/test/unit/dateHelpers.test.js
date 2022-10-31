const { expect } = require('chai');
const dateHelpers = require('../../app/utils/helpers/dateHelpers');

describe('dateHelpers.compareDates(date1,date2)', () => {
  it('should return true (date1 is greater than date2)', () => {
    const output = dateHelpers.compareDates(
      '2014-02-28 16:03',
      '2014-02-28 16:01'
    );
    expect(output).to.eql(true);
  });

  it('should return false (date2 is greater)', () => {
    const output = dateHelpers.compareDates(
      '2014-02-28 16:03',
      '2014-02-30 20:50'
    );
    expect(output).to.eql(false);
  });
});
