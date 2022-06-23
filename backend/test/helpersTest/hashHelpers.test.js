const chai = require("chai"),
  expect = chai.expect;
const hashHelpers = require("../../app/utils/hashHelpers");
const dataTest = require("../testData.json");

describe("hashHelpers.hashEmail(emailAddress)", function () {
  it("should return valid hash", function () {
    let output = hashHelpers.hashEmail(testData.emailsHash[0][0]);
    expect(output).eq(testData.emailsHash[0][1]);
  });
});
describe("hashHelpers.hashEmail(emailAddress)", function () {
  // TODO
});
describe("hashHelpers.hashEmail(emailAddress)", function () {
  // TODO
});
