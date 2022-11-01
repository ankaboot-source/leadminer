const supertest = require('supertest');
const { app } = require('../../app');
const {
  testImapEmail,
  testImapHost,
  testImapPassword
} = require('../../app/config/test.config');

describe('Full mining flow', () => {
  let loggedInUser;
  describe('login', () => {
    it('create user (login request)', async () => {
      await supertest(app)
        .post('/api/imap/login')
        .send({
          email: testImapEmail,
          password: testImapPassword,
          host: testImapHost
        })
        .expect((res) => {
          loggedInUser = res.body.imap;
        })
        .end((err, _) => {
          if (err) throw err;
          done();
        });
    });
  });

  describe('mine', () => {
    it('mine folder for the logged in user', async () => {
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
    });
  });

  describe('tree', () => {
    it('Get Tree from imap server', async () => {
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
});
