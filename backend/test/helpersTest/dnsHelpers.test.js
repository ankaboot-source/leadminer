const chai = require("chai"),
  expect = chai.expect;
const dnsHelpers = require("../../app/utils/dnsHelpers");
const redis = require("redis");
const client = redis.createClient(6379);
describe("dnsHelpers.checkDNS(emailAddress)", async function () {
  it("should return ok", async function () {
    let output = await dnsHelpers.checkDNS("gmail.com", client);
    expect(output).eq("ok");
  });
  it("should return ko", async function () {
    let output = await dnsHelpers.checkDNS("domain.lead122111miner.io");
    expect(output).eq("ko");
  });
  it("should return ko", async function () {
    let output = await dnsHelpers.checkDNS(undefined);
    expect(output).eq("ko");
  });
});
