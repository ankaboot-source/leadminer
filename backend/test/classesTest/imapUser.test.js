const chai = require('chai'),
  expect = chai.expect;
const imapUser = require('../../app/services/imapUser');
const dataTest = require('../testData.json');

describe('testCase for userImap class', function () {
  it('should return a non empty user object with parsed query : Case Api', function () {
    let user = new imapUser(dataTest.queryExampleApi);
    let output = user.getUserConnetionDataFromQuery();
    let expectedOutput = [
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
  it('should return a non empty user object with parsed query : Case Imap', function () {
    let user = new imapUser(dataTest.queryExampleImap);
    let output = user.getUserConnetionDataFromQuery();
    let expectedOutput = [
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
  it('should return a non empty user object with parsed query : Case emptyQuery', function () {
    let user = new imapUser({});
    let output = user.getUserConnetionDataFromQuery();
    let expectedOutput = [{}];
    expect([output]).to.have.deep.members(expectedOutput);
  });
});
