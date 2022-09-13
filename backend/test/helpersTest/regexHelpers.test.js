const chai = require("chai"),
  expect = chai.expect;
const regExHelpers = require("../../app/utils/regexpHelpers");
const testData = require("../testData.json");

describe("regExHelpers.extractEmailsFromBody(text)", async function () {
  it("should return array of emails", async function () {
    const output = regExHelpers.extractNameAndEmailFromBody(testData.emailBody);
    expect(output).to.eql(testData.expectedForBodyExtraction);
  });
});
describe("regExHelpers.extractNameAndEmail(data)", function () {
  it("should return valid name and email as object", function () {
    let output = regExHelpers.extractNameAndEmail(testData.EmailNameTest[0]);
    expect(output).to.have.deep.members(testData.expectedEmailNameAddress);
  });
});
