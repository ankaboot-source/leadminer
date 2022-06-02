const chai = require("chai"),
  expect = chai.expect;
const inputHelpers = require("../app/utils/inputHelpers");
const testData = require("./data/testData.json");

describe("inputHelpers.getPath(folders , folder)", function () {
  it("should return path if given a valid folders object", function () {
    let output = inputHelpers.getPath(testData.testPath, "Spam");
    expect(output.substring(1)).eq("Spam");
    let output2 = inputHelpers.getPath(testData.testPath, "test2");
    expect(output2.substring(1)).eq("INBOX/test/test2");
  });
});
describe("inputHelpers.getBoxesAll(folders)", function () {
  let imapBoxTreeExample = {
    Brouillons: {
      attribs: ["\\Drafts", "\\HasNoChildren"],
      delimiter: "/",
      children: null,
      parent: null,
      special_use_attrib: "\\Drafts",
    },
    INBOX: {
      attribs: ["\\HasChildren"],
      delimiter: "/",
      children: {
        mars: {
          attribs: ["\\Junk", "\\HasNoChildren"],
          delimiter: "/",
          children: null,
          parent: null,
          special_use_attrib: "\\Junk",
        },
        Administratif: {
          attribs: ["\\Junk", "\\HasNoChildren"],
          delimiter: "/",
          children: null,
          parent: null,
          special_use_attrib: "\\Junk",
        },
      },
      parent: null,
    },

    Spam: {
      attribs: ["\\Junk", "\\HasNoChildren"],
      delimiter: "/",
      children: null,
      parent: null,
      special_use_attrib: "\\Junk",
    },
  };
  let expectedOutput = [
    { label: "Brouillons" },

    {
      label: "INBOX",
      children: [{ label: "mars" }, { label: "Administratif" }],
    },
    { label: "Spam" },
  ];

  it("should return valid tree", function () {
    let Output = inputHelpers.getBoxesAll(imapBoxTreeExample);
    expect(Output).to.have.deep.members(expectedOutput);
  });
});

describe("inputHelpers.getBoxesAndFolders(BoxesNames)", function () {
  let imapBoxTreeExample = [
    '{"label":"Brouillons"}',
    '{"label":"INBOX","children":[{"label":"mars"},{"label":"Administratif"}]}',
    '{"label":"Spam"}',
  ];

  it("should return all paths, to each box, in an array", function () {
    let Query = {
      folders: imapBoxTreeExample,
      boxes: ["INBOX", "Spam", "mars"],
    };
    let output = inputHelpers.getBoxesAndFolders(Query);
    expect(output).to.eql(["INBOX", "Spam", "INBOX/mars"]);
  });
  it("should return empty string if path not found", function () {
    let Query = {
      folders: imapBoxTreeExample,
      boxes: ["INBOX", "Spam", "8mars"],
    };
    let output = inputHelpers.getBoxesAndFolders(Query);
    expect(output).to.eql(["INBOX", "Spam", ""]);
  });
});

describe("inputHelpers.EqualPartsForSocket(total)", function () {
  it("should return array of length 1 (range between 0 and 10)", function () {
    let output = inputHelpers.EqualPartsForSocket(9);
    expect(output).to.eql([9]);
  });
  it("should treat when range is not in the scope (case default parts number)", function () {
    let output = inputHelpers.EqualPartsForSocket(100000000000);

    expect(output).to.be.an("array").that.does.not.include(0);
  });
  it("should return empty array on negative numbers", function () {
    let output = inputHelpers.EqualPartsForSocket(-1);
    expect(output).to.have.lengthOf(0);
  });
});
describe("inputHelpers.sortDatabase(databaseArray", function () {
  let data = [
    {
      email: {
        name: '"MailerLite.fr"',
        address: "info@mailerlite.fr",
      },
      field: { from: 1, "reply-to": 1 },
      date: "2014-02-25 17:31",
      type: "Custom domain",
    },
  ];
  let expectedOutput = [
    {
      email: { name: "MailerLite.fr", address: "info@mailerlite.fr" },
      field: {
        from: 1,
        "reply-to": 1,
        total: 2,
        recipient: 0,
        body: 0,
        sender: 2,
      },
      date: "2014-02-25 17:31",
      type: "Custom domain",
    },
  ];
  it("should add recipient and sender props in fields", function () {
    let output = inputHelpers.sortDatabase(data);
    expect(output).to.have.deep.members(expectedOutput);
  });
});
