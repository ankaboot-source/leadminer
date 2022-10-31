const { expect } = require('chai');
const inputHelpers = require('../../app/utils/helpers/inputHelpers');

describe('inputHelpers.EqualPartsForSocket(total)', () => {
  it('should return array of length 1 (range between 0 and 10)', () => {
    const output = inputHelpers.EqualPartsForSocket(9);
    expect(output).to.eql([9]);
  });

  it('should treat when range is not in the scope (case default parts number)', () => {
    const output = inputHelpers.EqualPartsForSocket(100000000000);

    expect(output).to.be.an('array').that.does.not.include(0);
  });

  it('should return empty array on negative numbers', () => {
    const output = inputHelpers.EqualPartsForSocket(-1);
    expect(output).to.have.lengthOf(0);
  });
});
