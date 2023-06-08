import { Router } from 'express';
import initializeAuthMiddleware from '../middleware/auth';
import initializeImapController from '../controllers/imap.controller';
import { AuthClient } from '../db/AuthClient';

export default function initializeImapRoutes(authClient: AuthClient) {
  const router = Router();
  const { verifyJWT } = initializeAuthMiddleware(authClient);
  const { getImapBoxes, signinImap } = initializeImapController(authClient);

  router.post('/login', signinImap);
  router.get('/:userId/boxes', verifyJWT, getImapBoxes);

  return router;
}
