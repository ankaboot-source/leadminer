const { expect } = require('chai');
const emailMessageHelpers = require('../../app/utils/helpers/emailMessageHelpers');

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
