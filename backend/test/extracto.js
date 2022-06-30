const chai = require("chai"),
  expect = chai.expect;
const extractors = require("../../app/utils/extractors");
const testData = require("../testData.json");

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
        address: "leadminer-teams@leadminer.io",
      },
    };
    let Output = [...testData.ReadyData];
    let expectedOutput = [...testData.ReadyData];
    expectedOutput.push({
      email: {
        name: "leadminer-teams",
        address: "leadminer-teams@leadminer.io",
      },
    });

    extractors.addEmailToDatabase(Output, email);

    expect(Output).to.have.deep.members(expectedOutput);
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

describe("extractors.manipulateData(element, oneEmail, database, folder, messageDate)", function () {
  let expectedOutput = {
    email: {
      name: "leadminer-teams",
      address: "leadminer-team@leadminer.io",
    },
    field: { ["from"]: 1 },
    date: "2014-02-28 17:03",
    type: "Custom domain",
  };
  let expectedOutput1 = {
    email: {
      name: "leadminer-teams",
      address: "leadminer-team@leadminer.io",
    },
    field: { ["from"]: 2 },
    date: "2014-02-28 17:03",
    type: "Custom domain",
  };

  let expectedOutput2 = {
    email: {
      name: "leadminer-teams",
      address: "leadminer-team@leadminer.io",
    },
    field: { ["from"]: 3 },
    date: "2014-02-28 17:15",
    type: "Custom domain",
  };
  let expectedOutput3 = {
    email: {
      name: "leadminer-teams",
      address: "leadminer-team@leadminer.io",
    },
    field: { ["from"]: 3, ["body"]: 1 },
    date: "2014-02-28 17:15",
    type: "Custom domain",
  };
  let email = {
    name: "leadminer-teams",
    address: "leadminer-team@leadminer.io",
  };
  let databaseArray = [];
  it("should add data to database array", function () {
    extractors.manipulateData(
      "from",
      email,
      databaseArray,
      "INBOX",
      "Fri, 28 Feb 2014 18:03:09 UTC-0.0.0.0"
    );
    expect(databaseArray).to.have.deep.members([expectedOutput]);
  });
  it("should add mail to database and update field", function () {
    extractors.manipulateData(
      "from",
      email,
      databaseArray,
      "INBOX",
      "Fri, 28 Feb 2014 18:03:09 UTC-0.0.0.0"
    );
    expect(databaseArray).to.have.deep.members([expectedOutput1]);
  });
  it("should add mail to database and update date", function () {
    extractors.manipulateData(
      "from",
      email,
      databaseArray,
      "INBOX",
      "Fri, 28 Feb 2014 18:15:09 UTC-0.0.0.0"
    );
    expect(databaseArray).to.have.deep.members([expectedOutput2]);
  });
  it("should add mail to database and add a new field", function () {
    extractors.manipulateData(
      "body",
      email,
      databaseArray,
      "INBOX",
      "Fri, 28 Feb 2014 18:15:09 UTC-0.0.0.0"
    );
    expect(databaseArray).to.have.deep.members([expectedOutput3]);
  });
});
