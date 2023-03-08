const imap = require('../controllers/imap.controller');
const googleApiController = require('../controllers/google.controller.js');
const router = require('express').Router();

router.post('/signUpGoogle', googleApiController.signUpWithGoogle);
router.post('/login', imap.loginToAccount);
router.get('/:id/boxes', imap.getImapBoxes);

router.post('/mine/', imap.startMining);
router.post('/mine/:id/stop', imap.stopMining);


module.exports = router;
