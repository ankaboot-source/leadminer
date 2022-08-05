// const chai = require("chai"),
//   expect = chai.expect;
// const imapUser = require("../../app/services/imapUser");
// const emailServer = require("../../app/services/EmailServer");
// const dataTest = require("../testData.json");

// describe("testCase for emailServer class", function () {
//   it("should connect to imap server : Case imap", async function () {
//     const user = new ImapUser(
//       dataTest.queryExampleImap
//     ).getUserConnetionDataFromQuery();
//     // initialise imap server connection
//     const server = new emailServer(user);
//     let connetion = await server.connecte();
//     expect(connetion);
//   });
//   it("should return a non empty user object with parsed query : Case Imap", function () {
//     let user = new imapUser(dataTest.queryExampleImap);
//     let output = user.getUserConnetionDataFromQuery();
//     let expectedOutput = {
//       email: "leadminer",
//       id: "123456789",
//       password: "_123456789azertyuiop_",
//       host: "leadminer.io",
//       port: 993,
//     };
//     expect(output).to.have.deep.members(expectedOutput);
//   });
//   it("should return a non empty user object with parsed query : Case emptyQuery", function () {
//     let user = new imapUser({});
//     let output = user.getUserConnetionDataFromQuery();
//     let expectedOutput = {};
//     expect(output).to.have.deep.members(expectedOutput);
//   });
// });
