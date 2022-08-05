const assert = require("assert");
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
describe("Get Emails", function () {
  describe("GET /getEmails", function () {
    it("should return 200", async function () {
      const response = await request(app.server)
        .get("/api/imap/4a8ea26a-fc34-4603-a704-545786a3a8f9/collectEmails")
        .query({
          fields: [
            "HEADER.FIELDS (FROM TO CC BCC REPLY-TO DATE LIST-UNSUBSCRIBE REFERENCES)",
            "1",
          ],
          boxes: ["testFile"],
          user: `{"id":"4a8ea26a-fc34-4603-a704-545786a3a8f9","email":${process.env.EMAIL_IMAP},"password":${process.env.PASSWORD_IMAP},"host":${process.env.HOST_IMAP},"port":993}`,
        })
        .expect(200);
    });
  });
});
