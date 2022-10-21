const request = require('supertest');
const app = require('../../server');
const {
  testImapEmail,
  testImapHost,
  testImapPassword
} = require('../../app/config/test.config');

before((done) => {
  app.event.on('started', function () {
    done();
  });
});
after(async () => {
  require('../../server').stop();
});
describe('Full mining flow', function () {
  let loggedInUser;
  describe('login', function () {
    it('create user (login request)', async function () {
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

  describe('mine', function () {
    it('mine folder for the logged in user', async function () {
      // loggedInUser.email = '"' + loggedInUser.email + '"';
      // loggedInUser.host = '"' + loggedInUser.host + '"';
      await request(app.server)
        .get(`/api/imap/${loggedInUser.id}/collectEmails`)
        .query({
          fields: ['HEADER', '1'],
          boxes: ['testFile', '0'],
          user: `{"id":${'"' + loggedInUser.id + '"'},"email":${
            '"' + loggedInUser.email + '"'
          },"password":${'"' + testImapPassword + '"'},"host":${
            '"' + loggedInUser.host + '"'
          },"port":"993"}`
        })
        .expect(200);
    });
  });
  describe('tree', () => {
    it('Get Tree from imap server', async function () {
      await request(app.server)
        .get(`/api/imap/${loggedInUser.id.trim()}/boxes`)
        .query({
          user: `{"id":${'"' + loggedInUser.id + '"'},"email":${
            '"' + loggedInUser.email + '"'
          },"password":${'"' + testImapPassword + '"'},"host":${
            '"' + loggedInUser.host + '"'
          },"port":"993"}`
        })
        .expect(200);
    });
  });
});
