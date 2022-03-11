module.exports = (app) => {
  const imap = require('../controllers/imap.controller');

  const router = require('express').Router();

  // Create a new imap account
  router.post('/signup', imap.createImapInfo);
  router.post('/login', imap.loginToAccount);

  // Retrieve emails based on user prefrences for a given imap account
  router.get('/:id/boxes', imap.getImapBoxes);

  // Retrieve emails based on user prefrences for a given imap account
  router.get('/:id/collectEmails', imap.getEmails);

  app.use('/api/imap', router);
};
