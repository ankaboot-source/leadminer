const chai = require('chai'),
  expect = chai.expect,
  should = chai.should();
const utilsForRegEx = require('../app/utils/regexpUtils');
const inputHelpers = require('../app/utils/inputHelpers');
const testData = require('./data/testData.json');

describe('utilsForRegEx.extractEmailsFromBody(text)', async function () {
  it('should return array of emails', async function () {
    const output = utilsForRegEx.extractEmailsFromBody(testData.emailBody);
    expect(output).to.eql(testData.expectedForBodyExtraction);
  });
});
describe('utilsForRegEx.extractNameAndEmail(data)', function () {
  it('should return valid name and email as object', function () {
    const output = utilsForRegEx.extractNameAndEmail(testData.EmailNameTest);
    expect(output).to.have.deep.members(testData.expectedEmailNameAddress);
    const output1 = utilsForRegEx.extractNameAndEmail(testData.OneEmailNameTest);
    expect(output1).to.have.deep.members([
      testData.expectedEmailNameAddress[0],
    ]);
  });
});
describe('utilsForRegEx.FormatBodyEmail(data)', function () {
  it('should return valid name and email as object for emails extracted from email body', function () {
    const emails = utilsForRegEx.extractEmailsFromBody(testData.emailBody);
    const output = utilsForRegEx.FormatBodyEmail(emails);
    expect(output).to.have.deep.members(testData.dataForFormat);
  });
});
describe('utils.getPath(folders , folder)', async function () {
  it('should return path if given a valid folders object', async function () {
    const output = await inputHelpers.getPath(testData.testPath, 'Spam');
    expect(output.substring(1)).eq('Spam');
    const output2 = await inputHelpers.getPath(testData.testPath, 'test2');
    expect(output2.substring(1)).eq('INBOX/test/test2');
  });
});
