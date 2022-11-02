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
    it('should return bad request(400) error when a field is missing', (done) => {
      request(app)
        .post('/api/imap/signup')
        .send({
          email: testImapEmail
        })
        .expect(400, { error: 'Content can not be empty!' }, done());
    });

    it('should return internal server error(500) because of wrong credentials', (done) => {
      request(app)
        .post('/api/imap/signup')
        .send({
          email: testImapEmail,
          password: 'wrongpassword',
          host: testImapHost,
          port: 993,
          tls: true
        })
        .expect(
          500,
          { error: "We can't connect to your imap account." },
          done()
        );
    });
  });

  describe('POST /api/imap/login', () => {
    it('should return bad request(400) error when email field is missing', (done) => {
      request(app)
        .post('/api/imap/login')
        .send({
          notemail: 'thisIsNotTheEmailField'
        })
        .expect(400, { error: 'Content can not be empty!' }, done());
    });

    it('should return a message (welcome back !) when submitting account email', (done) => {
      request(app)
        .post('/api/imap/login')
        .send({
          email: testImapEmail
        })
        .expect(200, done());
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

describe('GET /logs', () => {
  it('Should send logs file', (done) => {
    request(app)
      .get('/logs')
      .expect(200)
      .expect('Content-Type', 'text/event-stream', done());
  });
});

describe('GET /', () => {
  it('Should return "Welcome to leadminer application." message', (done) => {
    request(app)
      .get('/')
      .expect(200, { message: 'Welcome to leadminer application.' }, done());
  });
});
