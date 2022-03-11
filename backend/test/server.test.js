const assert = require("assert");
const request = require("supertest");
require("dotenv").config();
const app = require("../server");

describe("server", function () {
  describe("GET /", function () {
    it("should return 200 OK with a specific message (Welcome to leadminer!)", async function () {
      const response = await request(app)
        .get("/")
        .expect(200)
        .expect("Content-Type", /json/);
      assert.strictEqual(
        response.body.message,
        "Welcome to leadminer application."
      );
    });
  });
});

describe("Authentication(imap)", function () {
  describe("POST /api/imap/signup", function () {
    it("should return a message (account already exists) when submitting existing account credentials", async function () {
      const response = await request(app)
        .post("/api/imap/signup")
        .send({
          email: process.env.EMAIL_IMAP,
          password: process.env.PASSWORD_IMAP,
          host: process.env.HOST_IMAP,
          port: 993,
          tls: true,
        })
        .expect(200)
        .expect("Content-Type", /json/);
      assert.strictEqual(
        response.body.message,
        "Your account already exists !"
      );
    });
    it("should return bad request(400) error when a field is missing", async function () {
      const response = await request(app)
        .post("/api/imap/signup")
        .send({
          email: process.env.EMAIL_IMAP,
          port: 993,
        })
        .expect(400)
        .expect("Content-Type", /json/);
      assert.strictEqual(response.body.error, "Content can not be empty!");
    });
    it("should return internal server error(500) because of wrong credentials", async function () {
      const response = await request(app)
        .post("/api/imap/signup")
        .send({
          email: process.env.EMAIL_IMAP,
          password: "wrongpassword",
          host: process.env.HOST_IMAP,
          port: 993,
          tls: true,
        })
        .expect(500)
        .expect("Content-Type", /json/);
      assert.strictEqual(
        response.body.message,
        "We can't connect to your imap account"
      );
    });
  });
  describe("POST /api/imap/login", function () {
    it("should return bad request(400) error when email field is missing", async function () {
      const response = await request(app)
        .post("/api/imap/login")
        .send({
          notemail: "thisIsNotTheEmailField",
        })
        .expect(400)
        .expect("Content-Type", /json/);
      assert.strictEqual(response.body.error, "Content can not be empty!");
    });
    it("should return a message (welcome back !) when submitting account email", async function () {
      const response = await request(app)
        .post("/api/imap/login")
        .send({
          email: process.env.EMAIL_IMAP,
        })
        .expect(200)
        .expect("Content-Type", /json/);
      assert.strictEqual(response.body.message, "Welcome back !");
    });
    it("should return internal server error(500) error when no account found", async function () {
      const response = await request(app)
        .post("/api/imap/login")
        .send({
          email: "email@noexistingaccount.io",
        })
        .expect(500)
        .expect("Content-Type", /json/);
      assert.strictEqual(
        response.body.error,
        "Your account does not exist ! try to sign up."
      );
    });
  });
});

describe("imap requests", function () {
  // describe("GET /api/imap/:id/boxes", function () {
  //   it("should return 200 OK when given a valid 'id' and valid imap email address that exists in the database", async function () {
  //     const response = await request(app)
  //       .get("/api/imap/1/boxes")
  //       .query({ id: 1 })
  //       .expect(200)
  //       .expect("Content-Type", /json/);
  //   });
  // });
  describe("GET /api/imap/:id/boxes", function () {
    it("should return 404  when given an invalid id (does not exist in the database)", async function () {
      const response = await request(app)
        .get("/api/imap/123/boxes")
        .query({ id: 1 })
        .expect(404);
    });
  });
});
