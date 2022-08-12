const assert = require("assert");
const chai = require("chai"),
  expect = chai.expect;
const request = require("supertest");
require("dotenv").config();
const app = require("../../server");
const config = require("config");
const emailTest = config.get("test.imap_email");
const hostTest = config.get("test.imap_host");
const passwordTest = config.get("test.imap_password");

describe("Authentication(imap)", function () {
  describe("POST /api/imap/signup", function () {
    // it("should return a message (account already exists) when submitting existing account credentials", async function () {
    //   const response = await request(app.server)
    //     .post("/api/imap/signup")
    //     .send({
    //       email: emailTest,
    //       password: process.env.PASSWORD_IMAP,
    //       host: process.env.HOST_IMAP,
    //       port: 993,
    //       tls: true,
    //     })
    //     .expect(200)
    //     .expect("Content-Type", /json/);
    //   assert.strictEqual(
    //     response.body.message,
    //     "Your account already exists !"
    //   );
    // });
    it("should return bad request(400) error when a field is missing", async function () {
      const response = await request(app.server)
        .post("/api/imap/signup")
        .send({
          email: emailTest,
          port: 993,
        })
        .expect(400)
        .expect("Content-Type", "text/event-stream; charset=utf-8");
      assert.strictEqual(
        JSON.parse(response.text)["error"],
        "Content can not be empty!"
      );
    });
    it("should return internal server error(500) because of wrong credentials", async function () {
      const response = await request(app.server)
        .post("/api/imap/signup")
        .send({
          email: emailTest,
          password: "wrongpassword",
          host: hostTest,
          port: 993,
          tls: true,
        })
        .expect(500);
      assert.strictEqual(
        JSON.parse(response.text)["error"],
        "We can't connect to your imap account."
      );
    });
  });
  describe("POST /api/imap/login", function () {
    it("should return bad request(400) error when email field is missing", async function () {
      const response = await request(app.server)
        .post("/api/imap/login")
        .send({
          notemail: "thisIsNotTheEmailField",
        })
        .expect(400);
      assert.strictEqual(
        JSON.parse(response.text)["error"],
        "Content can not be empty!"
      );
    });
    it("should return a message (welcome back !) when submitting account email", async function () {
      const response = await request(app.server)
        .post("/api/imap/login")
        .send({
          email: emailTest,
        })
        .expect(200);
    });
  });
});

// describe("imap requests", function () {
//   describe("GET /api/imap/:id/boxes", function () {
//     it("should return 404  when given an invalid id (does not exist in the database)", async function () {
//       const response = await request(app.server)
//         .get("/api/imap/123/boxes")
//         .query({ id: 1 })
//         .expect(404);
//     });
//   });
// });

describe("Get logs file", function () {
  describe("GET /logs", function () {
    it("should send logs file", async function () {
      const response = await request(app.server).get("/logs").expect(200);
      expect(response.header["content-type"]).to.have.string(
        "text/event-stream"
      );
    });
  });
});
