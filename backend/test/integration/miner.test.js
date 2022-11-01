const supertest = require('supertest');
const { app } = require('../../app');
const {
  testImapEmail,
  testImapHost,
  testImapPassword
} = require('../../app/config/test.config');

describe('Full mining flow', () => {
  it('create user (login request)', async () => {
    let loggedInUser;
    await supertest(app)
      .post('/api/imap/login')
      .send({
        email: testImapEmail,
        password: testImapPassword,
        host: testImapHost
      })
      .expect((res) => {
        loggedInUser = res.body.imap;
      });

    await supertest(app)
      .get(`/api/imap/${loggedInUser.id}/collectEmails`)
      .query({
        fields: ['HEADER', '1'],
        boxes: ['testFile', '0'],
        user: JSON.stringify({
          id: loggedInUser.id,
          email: loggedInUser.email,
          password: testImapPassword,
          host: loggedInUser.host,
          port: 993
        })
      })
      .expect(200);

    await supertest(app)
      .get(`/api/imap/${loggedInUser.id.trim()}/boxes`)
      .query({
        user: JSON.stringify({
          id: loggedInUser.id,
          email: loggedInUser.email,
          password: testImapPassword,
          host: loggedInUser.host,
          port: 993
        })
      })
      .expect(200);
  });
});
