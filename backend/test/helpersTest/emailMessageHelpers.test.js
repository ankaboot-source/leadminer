const chai = require("chai"),
  expect = chai.expect;
const emailMessageHelpers = require("../../app/utils/emailMessageHelpers");

describe("emailMessageHelpers.isNoReply(emailAddress)", function () {
  it("should return true for no-reply-leadminer@leadminer.io", function () {
    const output = emailMessageHelpers.isNoReply(
      "no-reply-leadminer@leadminer.io"
    );
    expect(output).to.be.true;
  });
  it("should return false for leadminer@leadminer.io", function () {
    const output = emailMessageHelpers.isNoReply("leadminer@leadminer.com");
    expect(output).to.be.false;
  });
});
describe("emailMessageHelpers.checkMXStatus(domain)", async function () {
  it("should return true", async function () {
    let output = await emailMessageHelpers.checkMXStatus("gmail.com");
    expect(output[0]).to.be.true;
  });
  it("should return false", async function () {
    let output = await emailMessageHelpers.checkMXStatus(
      "domain.lead122111miner.io"
    );
    expect(output[0]).to.be.false;
  });
});
describe("emailMessageHelpers.checkDomainStatus(emailAddress)", async function () {
  it("should return true", async function () {
    let output = await emailMessageHelpers.checkDomainStatus(
      "leadminer@gmail.com"
    );
    expect(output[0]).to.be.true;
    expect(output[1]).eq("provider");
  });
  it("should return false", async function () {
    let output = await emailMessageHelpers.checkDomainStatus(
      "domain.lead@122111miner.io"
    );
    expect(output[0]).to.be.false;
    expect(output[1]).eq("");
  });
});
