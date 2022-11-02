const { expect } = require('chai');
const hashHelpers = require('../../app/utils/helpers/hashHelpers');
const dataTest = require('../testData.json');

describe('hashHelpers.hashEmail(emailAddress)', () => {
  it('should return valid hash', () => {
    const output = hashHelpers.hashEmail(dataTest.emailsHash[0]);
    const expected = dataTest.emailsHash[1];
    expect(output).eq(expected);
  });
});
