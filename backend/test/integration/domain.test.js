const { expect } = require('chai');
const domainHelpers = require('../../app/utils/helpers/domainHelpers');

describe('domainHelpers.checkMXStatus(domain)', async () => {
  it('should return true', async () => {
    const validDomain = 'gmail.com';
    const output = await domainHelpers.checkMXStatus(validDomain);
    expect(output[0]).to.be.true;
  });

  it('should return false', async () => {
    const invalidDomain = 'domain.lead122111miner.io';
    const output = await domainHelpers.checkMXStatus(invalidDomain);
    expect(output[0]).to.be.false;
  });
});

describe('domainHelpers.checkDomainStatus(emailAddress)', async () => {
  it('should return true', async () => {
    const emailAddressWithValidDomain = 'leadminer@gmail.com';
    const output = await domainHelpers.checkDomainStatus(
      emailAddressWithValidDomain
    );
    expect(output[0]).to.be.true;
    expect(output[1]).eq('provider');
  });

  it('should return false', async () => {
    const emailAddressWithInvalidDomain = 'domain.lead@122111miner.io';
    const output = await domainHelpers.checkDomainStatus(
      emailAddressWithInvalidDomain
    );
    expect(output[0]).to.be.false;
    expect(output[1]).eq('');
  });
});
