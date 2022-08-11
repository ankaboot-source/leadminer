const chai = require("chai"),
  expect = chai.expect;
const utilsForRegEx = require("../../app/utils/regexpUtils");
const testData = require("../testData.json");

describe("utilsForRegEx.extractEmailsFromBody(text)", async function () {
  it("should return array of emails", async function () {
    const output = utilsForRegEx.extractNameAndEmailFromBody(
      testData.emailBody
    );
    expect(output).to.eql(testData.expectedForBodyExtraction);
  });
});
describe("utilsForRegEx.extractNameAndEmail(data)", function () {
  it("should return valid name and email as object", function () {
    let output = utilsForRegEx.extractNameAndEmail(testData.EmailNameTest[0]);
    expect(output).to.have.deep.members(testData.expectedEmailNameAddress);
  });
});
