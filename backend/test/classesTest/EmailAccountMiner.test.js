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
describe("Full maining flow", function () {
  let loggedInUser;
  describe("create user (login request)", function () {
    it("should create user and return 200", async function () {
      let res = await request(app.server)
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
  describe("Get Tree from imap server", function () {
    it("should return 200 ", async function () {
      const response = await request(app.server)
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
  describe("mine folder for the logged in user", function () {
    it("should mine and return 200", async function () {
      // loggedInUser.email = '"' + loggedInUser.email + '"';
      // loggedInUser.host = '"' + loggedInUser.host + '"';
      let res = await request(app.server)
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
