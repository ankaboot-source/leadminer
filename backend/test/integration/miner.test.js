const { expect } = require('chai');
const request = require('supertest');
const { app } = require('../../app');
const {
  testImapEmail,
  testImapHost,
  testImapPassword
} = require('../../app/config/test.config');

describe('Full mining flow', () => {
  it('Should login -> mine -> return tree', async () => {
    console.log(`TEST${testImapEmail}TE`);
    console.log(`TEST${testImapHost}TE`);
    console.log(`TEST${testImapPassword}TE`);

    const loginResponse = await request(app).post('/api/imap/login').send({
      email: testImapEmail,
      password: testImapPassword,
      host: testImapHost
    });

    expect(loginResponse.statusCode).to.equal(200);

    const loggedInUser = JSON.parse(loginResponse.text).imap;
    const imapLoginHeader = JSON.stringify({
      id: loggedInUser.id,
      email: loggedInUser.email,
      password: testImapPassword,
      host: loggedInUser.host,
      port: 993
    });

    const collectEmailsResponse = await request(app)
      .get(`/api/imap/${loggedInUser.id}/collectEmails`)
      .set('x-imap-login', imapLoginHeader);

    expect(collectEmailsResponse.statusCode).to.equal(200);

    const getBoxesResponse = await request(app)
      .get(`/api/imap/${loggedInUser.id.trim()}/boxes`)
      .set('x-imap-login', imapLoginHeader)
      .query({ boxes: 'testFile' });

    expect(getBoxesResponse.statusCode).to.equal(200);
  });
});
