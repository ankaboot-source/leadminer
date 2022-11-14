const imap = require('../controllers/imap.controller');
const googleApiController = require('../controllers/google.controller.js');
const router = require('express').Router();

router.post('/signup', imap.createImapInfo);
router.post('/signUpGoogle', googleApiController.signUpWithGoogle);
router.post('/login', imap.loginToAccount);
router.get('/:id/boxes', imap.getImapBoxes);
router.get('/:id/collectEmails', imap.getEmails);

module.exports = router;
