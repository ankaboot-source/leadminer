import { Router } from 'express';
import signUpWithGoogle from '../controllers/google.controller';
import {
  getImapBoxes,
  getMiningTask,
  loginToAccount,
  startMining,
  stopMiningTask
} from '../controllers/imap.controller';

const router = Router();

router.post('/signUpGoogle', signUpWithGoogle);
router.post('/login', loginToAccount);
router.get('/:id/boxes', getImapBoxes);

router.post('/mine/:userid', startMining);
router.get('/mine/:userid/:id', getMiningTask);
router.delete('/mine/:userid/:id', stopMiningTask);

export default router;
