const { expect } = require('chai');
const regExHelpers = require('../../app/utils/helpers/regexpHelpers');
const testData = require('../testData.json');

describe('regExHelpers.extractEmailsFromBody(text)', () => {
  
  it('should return a valid array of emails', () => {
    const output = regExHelpers.extractNameAndEmailFromBody(testData.emailBody);
    expect(output).to.eql(testData.expectedForBodyExtraction);
  });

  it('should return only valid emails', () => {
    const output = regExHelpers.extractNameAndEmailFromBody(testData.randomEmails);
    expect(output).to.eql(testData.validrandomEmails.split(' '));
  });
});

describe('regExHelpers.extractNameAndEmail(data)', () => {
  it('should return valid name and email as object', () => {
    const output = regExHelpers.extractNameAndEmail(testData.EmailNameTest[0]);
    expect(output).to.have.deep.members(testData.expectedEmailNameAddress);
  });
});
