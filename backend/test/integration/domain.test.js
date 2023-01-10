const { expect } = require('chai');
const { redis } = require('../../app/utils/redis');
const domainHelpers = require('../../app/utils/helpers/domainHelpers');

const redisClient = redis.getClient()

describe('domainHelpers.checkMXStatus(domain)', () => {
  it('should return true', async () => {
    const validDomain = 'gmail.com';
    const output = await domainHelpers.checkMXStatus(redisClient, validDomain);
    expect(output[0]).to.be.true;
  });

  it('should return false', async () => {
    const invalidDomain = 'domain.lead122111miner.io';
    const output = await domainHelpers.checkMXStatus(redisClient, invalidDomain);
    expect(output[0]).to.be.false;
  });
});

describe('domainHelpers.checkDomainStatus(emailAddress)', () => {
  it('should return true', async () => {
    const emailAddressWithValidDomain = 'leadminer@gmail.com';
    const output = await domainHelpers.checkDomainStatus(
      redisClient,
      emailAddressWithValidDomain
    );
    expect(output[0]).to.be.true;
    expect(output[1]).eq('provider');
  });

  it('should return false', async () => {
    const emailAddressWithInvalidDomain = 'domain.lead@122111miner.io';
    const output = await domainHelpers.checkDomainStatus(
      redisClient,
      emailAddressWithInvalidDomain
    );
    expect(output[0]).to.be.false;
    expect(output[1]).eq('');
  });
});
