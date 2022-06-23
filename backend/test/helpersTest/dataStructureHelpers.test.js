const chai = require("chai"),
  expect = chai.expect;
const dataStructureHelpers = require("../../app/utils/dataStructureHelpers");
const dataTest = require("../testData.json");

describe("dataStructureHelpers.addPathPerFolder(imapTree , imapTreeFromImapServer)", function () {
  it("should add for each folder a valid path", function () {
    let output = dataStructureHelpers.addPathPerFolder(
      dataTest.imapTree,
      dataTest.imapTreeExample
    );
    expect(output.substring(1)).eq("Spam");
    let output2 = inputHelpers.getPath(testData.testPath, "test2");
    expect(output2.substring(1)).eq("INBOX/test/test2");
  });
});
describe("dataStructureHelpers.createReadableTreeObjectFromImapTree(imapTree)", function () {
  let imapTreeExample = dataTest.imapBoxTreeExample;
  let expectedOutput = [
    { label: "Brouillons" },

    {
      label: "INBOX",
      children: [{ label: "mars" }, { label: "Administratif" }],
    },
    { label: "Spam" },
  ];

  it("should return valid tree", function () {
    let Output = inputHelpers.getBoxesAll(imapTreeExample);
    expect(Output).to.have.deep.members(expectedOutput);
  });
});
