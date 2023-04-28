import { Router } from 'express';
import signUpWithGoogle from '../controllers/google.controller';
import { GooglePassport } from '../controllers/oauth.controller';
import {
  getImapBoxes,
  getMiningTask,
  loginToAccount,
  startMining,
  stopMiningTask
} from '../controllers/imap.controller';

const querystring = require('querystring');

const router = Router();

router.post('/signUpGoogle', signUpWithGoogle);
router.post('/login', loginToAccount);
router.get('/:id/boxes', getImapBoxes);

router.post('/mine/:userid', startMining);
router.get('/mine/:userid/:id', getMiningTask);
router.delete('/mine/:userid/:id', stopMiningTask);

// Redirect the user to the Microsoft login page
router.get('/auth/google', GooglePassport.authenticate('google', { session: false }));

// Handle the callback from the Microsoft login page
router.get('/auth/google/callback', GooglePassport.authenticate('google', { session: false }),
  (req, res) => {
    // Redirect to the app home page after successful authentication
    const redirectUriBase = 'http://localhost:8082/login/callback';
    const redirectUriQuery = querystring.stringify({ ...req.user });
    const redirectUri = `${redirectUriBase}?${redirectUriQuery}`;
    res.redirect(redirectUri);
  });



export default router;
