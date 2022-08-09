const chai = require("chai"),
  expect = chai.expect;
const request = require("supertest");
const app = require("../../server");

before((done) => {
  app.event.on("started", function () {
    done();
  });
});
after(async () => {
  require("../../server").stop();
});
describe("Get Emails from imap server full flow", function () {
  describe("GET /getEmails", function () {
    it("should return 200 and test a full flow mining case", async function () {
      const response = await request(app.server)
        .get("/api/imap/4a8ea26a-fc34-4603-a704-545786a3a8f9/collectEmails")
        .query({
          fields: ["HEADER", "1"],
          boxes: ["testFile"],
          user: `{"id":"4a8ea26a-fc34-4603-a704-545786a3a8f9","email":${process.env.EMAIL_IMAP},"password":${process.env.PASSWORD_IMAP},"host":${process.env.HOST_IMAP},"port":993}`,
        })
        .expect(200);
    });
  });
});
describe("Get Tree from imap server", function () {
  describe("GET /boxes", function () {
    it("should return 200 and test a full flow mining case", async function () {
      const response = await request(app.server)
        .get("/api/imap/4a8ea26a-fc34-4603-a704-545786a3a8f9/boxes")
        .query({
          user: `{"id":"4a8ea26a-fc34-4603-a704-545786a3a8f9","email":${process.env.EMAIL_IMAP},"password":${process.env.PASSWORD_IMAP},"host":${process.env.HOST_IMAP},"port":993}`,
        })
        .expect(200);
    });
  });
});
