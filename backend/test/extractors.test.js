const chai = require("chai"),
  expect = chai.expect;
const extractors = require("../app/utils/extractors");
const inputHelpers = require("../app/utils/inputHelpers");
const testData = require("./data/testData.json");

describe("extractors.checkExistence(databaseArray , email)", async function () {
  it("should return true for leadminer-team@leadminer.io", async function () {
    const testEmail1 = { address: "leadminer-team@leadminer.io" };
    const output = extractors.checkExistence(
      testData.minedDataExample,
      testEmail1
    );
    expect(output).to.be.true;
  });
  it("should return false leadminer-team@leadminer.com", async function () {
    const testEmail1 = { address: "leadminer-team@leadminer.com" };
    const output = extractors.checkExistence(
      testData.minedDataExample,
      testEmail1
    );
    expect(output).to.be.false;
  });
});
describe("extractors.IsNotNoReply(oneEmail, imapEmail)", function () {
  it("should return false for no-reply-leadminer@leadminer.io", function () {
    const output = extractors.IsNotNoReply(
      "no-reply-leadminer@leadminer.io",
      "leadminer-team@leadminer.io"
    );
    expect(output).to.be.false;
  });
  it("should return true for leadminer@leadminer.io", function () {
    const output = extractors.IsNotNoReply(
      "leadminer@leadminer.com",
      "leadminer-team@leadminer.io"
    );
    expect(output).to.be.true;
  });
});
describe("extractors.addEmailToDatabase(databaseArray, email)", function () {
  it("should append email object to DatabaseArray", function () {
    let email = {
      email: {
        name: "leadminer-teams",
        address: "leadminer-team@leadminer.io",
      },
    };
    const expectedOutput = testData.ReadyData;
    expectedOutput.push({
      name: "leadminer-teams",
      address: "leadminer-team@leadminer.io",
    });
    let Output = testData.ReadyData;
    extractors.addEmailToDatabase(Output, email);

    expect(expectedOutput).to.have.deep.members(Output);
  });
});

describe("extractors.addEmailType(emailInfo)", function () {
  it("should add 'Email provider' to emailInfo as type ", function () {
    let email = {
      email: {
        name: "leadminer-teams",
        address: "leadminer-team@gmail.com",
      },
    };
    const expectedOutput = {
      email: {
        name: "leadminer-teams",
        address: "leadminer-team@gmail.com",
      },
      type: "Email provider",
    };

    let Output = extractors.addEmailType(email);

    expect([expectedOutput]).to.have.deep.members([Output]);
  });
  it("should add 'Disposable email' to emailInfo as type ", function () {
    let email = {
      email: {
        name: "leadminer-teams",
        address: "leadminer-team@spamwc.cf",
      },
    };
    const expectedOutput = {
      email: {
        name: "leadminer-teams",
        address: "leadminer-team@spamwc.cf",
      },
      type: "Disposable email",
    };

    let Output = extractors.addEmailType(email);

    expect([expectedOutput]).to.have.deep.members([Output]);
  });
  it("should add 'Custom domain' to emailInfo as type ", function () {
    let email = {
      email: {
        name: "leadminer-teams",
        address: "leadminer-team@leadminer.io",
      },
    };
    const expectedOutput = {
      email: {
        name: "leadminer-teams",
        address: "leadminer-team@leadminer.io",
      },
      type: "Custom domain",
    };

    let Output = extractors.addEmailType(email);

    expect([expectedOutput]).to.have.deep.members([Output]);
  });
});
