const { expect } = require('chai');
const request = require('supertest');
const { app } = require('../../app');
const { testImapEmail, testImapHost } = require('../../app/config/test.config');

describe('Authentication(imap)', () => {
  describe('POST /api/imap/signup', () => {
    // it("should return a message (account already exists) when submitting existing account credentials", async () => {
    //   const response = await request(app.server)
    //     .post("/api/imap/signup")
    //     .send({
    //       email: emailTest,
    //       password: process.env.PASSWORD_IMAP,
    //       host: process.env.HOST_IMAP,
    //       port: 993,
    //       tls: true,
    //     })
    //     .expect(200)
    //     .expect("Content-Type", /json/);
    //   assert.strictEqual(
    //     response.body.message,
    //     "Your account already exists !"
    //   );
    // });
    it('should return bad request(400) error when a field is missing', async () => {
      const response = await request(app).post('/api/imap/signup').send({
        email: testImapEmail,
        port: 993
      });

      expect(response.statusCode).to.equal(400);
      expect(response.body).to.equal({ error: 'Content can not be empty!' });
      expect(response.headers['Content-Type']).to.equal(
        'text/event-stream; charset=utf-8'
      );
    });

    it('should return internal server error(500) because of wrong credentials', async () => {
      const response = await request(app).post('/api/imap/signup').send({
        email: testImapEmail,
        password: 'wrongpassword',
        host: testImapHost,
        port: 993,
        tls: true
      });
      expect(response.statusCode).to.equal(500);
      expect(response.body).to.equal({
        error: "We can't connect to your imap account."
      });
    });
  });
  describe('POST /api/imap/login', () => {
    it('should return bad request(400) error when email field is missing', async () => {
      const response = await request(app).post('/api/imap/login').send({
        notemail: 'thisIsNotTheEmailField'
      });

      expect(response.status).to.equal(400);
      expect(response.body).to.equal({ error: 'Content can not be empty!' });
    });
    it('should return a message (welcome back !) when submitting account email', async () => {
      const response = await request(app).post('/api/imap/login').send({
        email: testImapEmail
      });

      expect(response.statusCode).to.equal(200);
    });
  });
});

// describe("imap requests", () => {
//   describe("GET /api/imap/:id/boxes", () => {
//     it("should return 404  when given an invalid id (does not exist in the database)", async () => {
//       const response = await request(app.server)
//         .get("/api/imap/123/boxes")
//         .query({ id: 1 })
//         .expect(404);
//     });
//   });
// });

describe('Get logs file', () => {
  describe('GET /logs', () => {
    it('should send logs file', async () => {
      const response = await request(app).get('/logs');

      expect(response.statusCode).to.equal(200);
      expect(response.headers['content-type']).to.equal('text/event-stream');
    });
  });
});
