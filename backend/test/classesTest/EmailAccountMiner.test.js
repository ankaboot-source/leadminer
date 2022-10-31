const request = require('supertest');
const app = require('../../server');
const {
  testImapEmail,
  testImapHost,
  testImapPassword
} = require('../../app/config/test.config');
const { json } = require('sequelize/types');

before((done) => {
  app.event.on('started', () => {
    done();
  });
});
after(async () => {
  require('../../server').stop();
});
describe('Full mining flow', () => {
  const userObject = {
    id: loggedInUser.id,
    email: loggedInUser.email,
    password: testImapPassword,
    host: loggedInUser.host,
    port: 993
  };
  let loggedInUser;
  describe('login', () => {
    it('create user (login request)', async () => {
      await request(app.server)
        .post('/api/imap/login')
        .send({
          email: testImapEmail,
          password: testImapPassword,
          host: testImapHost
        })
        .expect((res) => {
          loggedInUser = JSON.parse(res.text).imap;
        });
    });
  });

  describe('mine', () => {
    it('mine folder for the logged in user', async () => {
      await request(app.server)
        .get(`/api/imap/${loggedInUser.id}/collectEmails`)
        .query({
          fields: ['HEADER', '1'],
          boxes: ['testFile', '0'],
          user: JSON.stringify(userObject)
        })
        .expect(200);
    });
  });
  describe('tree', () => {
    it('Get Tree from imap server', async () => {
      await request(app.server)
        .get(`/api/imap/${loggedInUser.id.trim()}/boxes`)
        .query({
          user: JSON.stringify(userObject)
        })
        .expect(200);
    });
  });
});
