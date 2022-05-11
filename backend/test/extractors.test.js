const chai = require("chai"),
  expect = chai.expect,
  should = chai.should();
const extractors = require("../app/utils/extractors");
const inputHelpers = require("../app/utils/inputHelpers");
const testData = require("./data/testData.json");

describe("extractors.checkExistence(databaseArray , email)", async function () {
  it("should return true for leadminer-team@leadminer.io", async function () {
    let testEmail1 = { address: "leadminer-team@leadminer.io" };
    const output = extractors.checkExistence(
      testData.minedDataExample,
      testEmail1
    );
    expect(output).to.be.true;
  });
  it("should return false leadminer-team@leadminer.com", async function () {
    let testEmail1 = { address: "leadminer-team@leadminer.com" };
    const output = extractors.checkExistence(
      testData.minedDataExample,
      testEmail1
    );
    expect(output).to.be.false;
  });
});
describe("extractors.IsNotNoReply(oneEmail, imapEmail)", function () {
  it("should return false for no-reply-leadminer@leadminer.io", function () {
    let output = extractors.IsNotNoReply(
      "no-reply-leadminer@leadminer.io",
      "leadminer-team@leadminer.io"
    );
    expect(output).to.be.false;
  });
  it("should return true for leadminer@leadminer.io", function () {
    let output = extractors.IsNotNoReply(
      "leadminer@leadminer.com",
      "leadminer-team@leadminer.io"
    );
    expect(output).to.be.true;
  });
});
describe("extractors.addEmailToDatabase(databaseArray, email)", function () {
  it("should append email object to DatabaseArray", function () {
    let email = {
      name: "leadminer-team",
      address: "leadminer-team@leadminer.io",
    };
    let expectedOutput = testDat.expectedEmailNameAddress.push({
      name: "leadminer-team",
      address: "leadminer-team@leadminer.io",
    });
    let output = extractors.addEmailToDatabase(
      testData.expectedEmailNameAddress,
      email
    );
    expect(output).to.have.deep.members(expectedOutput);
  });
});
