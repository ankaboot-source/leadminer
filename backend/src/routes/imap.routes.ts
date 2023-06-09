import { Router } from 'express';
import initializeAuthMiddleware from '../middleware/auth';
import initializeImapController from '../controllers/imap.controller';
import { AuthResolver } from '../services/auth/types';

export default function initializeImapRoutes(authResolver: AuthResolver) {
  const router = Router();
  const { verifyJWT } = initializeAuthMiddleware(authResolver);
  const { getImapBoxes, signinImap } = initializeImapController(authResolver);

  router.post('/login', signinImap);
  router.get('/:userId/boxes', verifyJWT, getImapBoxes);

  return router;
}
