const { expect } = require('chai');
const regExHelpers = require('../../app/utils/helpers/regexpHelpers');
const testData = require('../testData.json');

describe('regExHelpers.extractEmailsFromBody(text)', async () => {
  it('should return array of emails', async () => {
    const output = regExHelpers.extractNameAndEmailFromBody(testData.emailBody);
    expect(output).to.eql(testData.expectedForBodyExtraction);
  });
});

describe('regExHelpers.extractNameAndEmail(data)', () => {
  it('should return valid name and email as object', () => {
    const output = regExHelpers.extractNameAndEmail(testData.EmailNameTest[0]);
    expect(output).to.have.deep.members(testData.expectedEmailNameAddress);
  });
});
