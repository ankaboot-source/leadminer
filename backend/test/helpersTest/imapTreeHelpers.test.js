const chai = require("chai"),
  expect = chai.expect;
const imapTreeHelpers = require("../../app/utils/imapTreeHelpers");
const dataTest = require("../testData.json");

describe("imapTreeHelpers.createTreeFromImap(imapTree)", function () {
  let imapTreeExample = dataTest.imapTreeExample;
  let expectedOutput = [
    { label: "Brouillons" },
    {
      label: "INBOX",
      children: [{ label: "mars" }, { label: "Administratif" }],
    },
    { label: "Spam" },
  ];
  it("should return valid tree", function () {
    let Output = imapTreeHelpers.createTreeFromImap(imapTreeExample);
    expect(Output).to.have.deep.members(expectedOutput);
  });
});
describe("imapTreeHelpers.addPathPerFolder(imapTree, imapTreeFromImapServer)", function () {
  it("should add path for each folder", function () {
    let expectedOutput = [
      { label: "Brouillons", path: "Brouillons" },

      {
        label: "INBOX",
        path: "INBOX",
        children: [
          { label: "mars", path: "INBOX/mars" },
          { label: "Administratif", path: "INBOX/Administratif" },
        ],
      },
      { label: "Spam", path: "Spam" },
    ];
    let tree = [
      { label: "Brouillons" },

      {
        label: "INBOX",
        children: [{ label: "mars" }, { label: "Administratif" }],
      },
      { label: "Spam" },
    ];
    let output = imapTreeHelpers.addPathPerFolder(tree, tree);
    expect(output).to.have.deep.members(expectedOutput);
  });
});
