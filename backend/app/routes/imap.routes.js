const imap = require('../controllers/imap.controller');
const googleApiController = require('../controllers/google.controller.js');
const router = require('express').Router();

router.post('/signUpGoogle', googleApiController.signUpWithGoogle);
router.post('/login', imap.loginToAccount);
router.get('/:id/boxes', imap.getImapBoxes);

router.post('/mine/:userid', imap.startMining);
router.get('/mine/:userid/:id', imap.getMiningTask);
router.delete('/mine/:userid/:id', imap.stopMiningTask);

module.exports = router;
