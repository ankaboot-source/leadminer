const chai = require("chai"),
  expect = chai.expect;
const request = require("supertest");
const app = require("../../server");
const config = require("config");
const emailTest = config.get("test.imap_email");
const hostTest = config.get("test.imap_host");
const passwordTest = config.get("test.imap_password");

before((done) => {
  app.event.on("started", function () {
    done();
  });
});
after(async () => {
  require("../../server").stop();
});
describe("Full mining flow", function () {
  this.timeout(40000);
  let loggedInUser;
  describe("login", function () {
    it("create user (login request)", async function () {
      await request(app.server)
        .post("/api/imap/login")
        .send({
          email: emailTest,
          password: passwordTest,
          host: hostTest,
        })
        .expect((res) => {
          loggedInUser = JSON.parse(res.text).imap;
        });
    });
  });
  describe("tree", function () {
    it("Get Tree from imap server", async function () {
      await request(app.server)
        .get(`/api/imap/${loggedInUser.id}/boxes`)
        .query({
          user: `{"id":${'"' + loggedInUser.id + '"'},"email":${
            '"' + loggedInUser.email + '"'
          },"password":${'"' + passwordTest + '"'},"host":${
            '"' + loggedInUser.host + '"'
          },"port":"993"}`,
        })
        .expect(200);
    });
  });
  describe("mine", function () {
    it("mine folder for the logged in user", async function () {
      // loggedInUser.email = '"' + loggedInUser.email + '"';
      // loggedInUser.host = '"' + loggedInUser.host + '"';
      await request(app.server)
        .get(`/api/imap/${loggedInUser.id}/collectEmails`)
        .query({
          fields: ["HEADER", "1"],
          boxes: ["testFile", "none"],
          user: `{"id":${'"' + loggedInUser.id + '"'},"email":${
            '"' + loggedInUser.email + '"'
          },"password":${'"' + passwordTest + '"'},"host":${
            '"' + loggedInUser.host + '"'
          },"port":"993"}`,
        })
        .expect(200);
    });
  });
});
