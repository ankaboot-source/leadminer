const chai = require("chai"),
  expect = chai.expect;
const dataStructureHelpers = require("../../app/utils/dataStructureHelpers");
const dataTest = require("../testData.json");

describe("dataStructureHelpers.createReadableTreeObjectFromImapTree(imapTree)", function () {
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
    let Output =
      dataStructureHelpers.createReadableTreeObjectFromImapTree(
        imapTreeExample
      );
    expect(Output).to.have.deep.members(expectedOutput);
  });
});
describe("dataStructureHelpers.addPathPerFolder(imapTree, imapTreeFromImapServer)", function () {
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
    let output = dataStructureHelpers.addPathPerFolder(tree, tree);
    expect(output).to.have.deep.members(expectedOutput);
  });
});
describe("dataStructureHelpers.IsNotNoReply(oneEmail, imapEmail)", function () {
  it("should return false for no-reply-leadminer@leadminer.io", function () {
    const output = dataStructureHelpers.IsNotNoReply(
      "no-reply-leadminer@leadminer.io",
      "leadminer-team@leadminer.io"
    );
    expect(output).to.be.false;
  });
  it("should return true for leadminer@leadminer.io", function () {
    const output = dataStructureHelpers.IsNotNoReply(
      "leadminer@leadminer.com",
      "leadminer-team@leadminer.io"
    );
    expect(output).to.be.true;
  });
});
// describe("dataStructureHelpers.addChildrenTotalForParentFiles(imapTree,userEmails)", function () {
//   let imapTreeExample = dataTest.imapBoxTreeExample;
//   let expectedOutput = [
//     { label: "Brouillons" },

//     {
//       label: "INBOX",
//       children: [{ label: "mars" }, { label: "Administratif" }],
//     },
//     { label: "Spam" },
//   ];

//   it("should return valid tree", function () {
//     let Output =
//       dataStructureHelpers.addChildrenTotalForParentFiles(imapTreeExample);
//     expect(Output).to.have.deep.members(expectedOutput);
//   });
// });
