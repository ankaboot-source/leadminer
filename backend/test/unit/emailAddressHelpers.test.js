const { expect } = require('chai');

const {
  findEmailAddressType,
  isNoReply
} = require('../../app/utils/helpers/emailAddressHelpers');

describe('emailAddressHelpers.findEmailAddressType()', () => {
  it('should return "Professional" for custom domain type', () => {
    const type = findEmailAddressType('custom');
    expect(type).to.equal('professional');
  });

  it('should return "Personal" for provider domain type', () => {
    const type = findEmailAddressType('provider');
    expect(type).to.equal('personal');
  });

  it('should return an empty string for invalid input', () => {
    const type = findEmailAddressType('invalid-provider');
    expect(type).to.equal('');
  });
});

describe('emailAddressHelpers.isNoReply(emailAddress)', () => {
  it('should return true for no-reply-leadminer@leadminer.io', () => {
    const output = isNoReply('no-reply-leadminer@leadminer.io');
    expect(output).to.be.true;
  });

  it('should return false for leadminer@leadminer.io', () => {
    const output = isNoReply('leadminer@leadminer.com');
    expect(output).to.be.false;
  });
});
