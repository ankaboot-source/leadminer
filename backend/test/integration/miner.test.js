const request = require('supertest');
const { app } = require('../../app');
const {
  testImapEmail,
  testImapHost,
  testImapPassword
} = require('../../app/config/test.config');

describe('Full mining flow', () => {
  it('Should login -> mine -> return tree', (done) => {
    request(app)
      .post('/api/imap/login')
      .send({
        email: testImapEmail,
        password: testImapPassword,
        host: testImapHost
      })
      // .expect(200)
      .then((response) => {
        const loggedInUser = response.body.imap;
        supertest(app)
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

        supertest(app)
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
          .expect(200, done());
      });
  });
});
