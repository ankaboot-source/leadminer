module.exports = (app, sse) => {
  const imap = require('../controllers/imap.controller');
  const router = require('express').Router();

  // Create a new imap account
  router.post('/signup', imap.createImapInfo);
  // login into account
  router.post('/login', imap.loginToAccount);
  // Retrieve emails based on user prefrences for a given imap account
  router.get('/:id/boxes', imap.getImapBoxes);
  // Retrieve emails based on user prefrences for a given imap account
  router.get('/:id/collectEmails', (req, res) => {
    imap.getEmails(req, res, sse);
  });

  app.use('/api/imap', router);
};
