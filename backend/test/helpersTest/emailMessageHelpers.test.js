const chai = require('chai'),
  expect = chai.expect;
const emailMessageHelpers = require('../../app/utils/emailMessageHelpers');

describe('emailMessageHelpers.isNoReply(emailAddress)', () => {
  it('should return true for no-reply-leadminer@leadminer.io', () => {
    const output = emailMessageHelpers.isNoReply(
      'no-reply-leadminer@leadminer.io'
    );
    expect(output).to.be.true;
  });
  it('should return false for leadminer@leadminer.io', () => {
    const output = emailMessageHelpers.isNoReply('leadminer@leadminer.com');
    expect(output).to.be.false;
  });
});
describe('emailMessageHelpers.checkMXStatus(domain)', async () => {
  it('should return true', async () => {
    let output = await emailMessageHelpers.checkMXStatus('gmail.com');
    expect(output[0]).to.be.true;
  });
  it('should return false', async () => {
    let output = await emailMessageHelpers.checkMXStatus(
      'domain.lead122111miner.io'
    );
    expect(output[0]).to.be.false;
  });
});
describe('emailMessageHelpers.checkDomainStatus(emailAddress)', async () => {
  it('should return true', async () => {
    let output = await emailMessageHelpers.checkDomainStatus(
      'leadminer@gmail.com'
    );
    expect(output[0]).to.be.true;
    expect(output[1]).eq('provider');
  });
  it('should return false', async () => {
    let output = await emailMessageHelpers.checkDomainStatus(
      'domain.lead@122111miner.io'
    );
    expect(output[0]).to.be.false;
    expect(output[1]).eq('');
  });
});
