const imap = require('../controllers/imap.controller');
const googleApiController = require('../controllers/google.controller.js'),
  router = require('express').Router();

module.exports = (app, sse, client) => {
  // Create a new imap account
  router.post('/signup', imap.createImapInfo);
  // signUp with google account route
  router.post('/signUpGoogle', (req, res) => {
    googleApiController.signUpWithGoogle(req, res);
  });
  // login into account
  router.post('/login', imap.loginToAccount);
  // Retrieve emails based on user prefrences for a given imap account
  router.get('/:id/boxes', (req, res) => {
    process.on('uncaughtException', () => {
      res.status(500).end();
    });
    imap.getImapBoxes(req, res, sse);
  });
  // Retrieve emails based on user prefrences for a given imap account
  router.get('/:id/collectEmails', (req, res) => {
    imap.getEmails(req, res, sse, client);
  });

  app.use('/api/imap', router);
};
