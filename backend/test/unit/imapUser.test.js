const { expect } = require('chai');
const imapUser = require('../../app/services/imapUser');
const dataTest = require('../testData.json');

describe('testCase for userImap class', () => {
  it('should return a non empty user object with parsed query : Case Api', () => {
    const user = new imapUser(dataTest.queryExampleApi);
    const output = user.getUserConnectionDataFromQuery();
    const expectedOutput = [
      {
        email: 'leadminer',
        id: '123456789',
        refreshToken: '/refresh_leadminer_token_123456789',
        token: '/access_leadminer_token_123456789',
        port: 993
      }
    ];
    expect([output]).to.have.deep.members(expectedOutput);
  });

  it('should return a non empty user object with parsed query : Case Imap', () => {
    const user = new imapUser(dataTest.queryExampleImap);
    const output = user.getUserConnectionDataFromQuery();
    const expectedOutput = [
      {
        email: 'leadminer',
        id: '123456789',
        password: '_123456789azertyuiop_',
        host: 'leadminer.io',
        port: '993'
      }
    ];
    expect([output]).to.have.deep.members(expectedOutput);
  });

  it('should return a non empty user object with parsed query : Case emptyQuery', () => {
    const user = new imapUser({});
    const output = user.getUserConnectionDataFromQuery();
    const expectedOutput = [{}];
    expect([output]).to.have.deep.members(expectedOutput);
  });
});
