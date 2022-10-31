const { expect } = require('chai');
const hashHelpers = require('../../app/utils/helpers/hashHelpers');
const dataTest = require('../testData.json');

describe('hashHelpers.hashEmail(emailAddress)', function () {
  it('should return valid hash', function () {
    const output = hashHelpers.hashEmail(dataTest.emailsHash[0]);
    expect(output).eq(dataTest.emailsHash[1]);
  });
});
