const { expect } = require('chai');
const hashHelpers = require('../../app/utils/helpers/hashHelpers');

describe('hashHelpers.hashEmail(emailAddress)', () => {
  it('should return valid hash', () => {
    const output = hashHelpers.hashEmail(dataTest.emailsHash[0]);
    const expected =
      '9d18a49b21fc1eed4096d8c84eaebcddd03caa9eab536a885aac6a509a6b1edd';
    expect(output).eq(expected);
  });
});
