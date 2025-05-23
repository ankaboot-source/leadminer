import { Router } from 'express';
import initializeImapController from '../controllers/imap.controller';
import { MiningSources } from '../db/interfaces/MiningSources';
import initializeAuthMiddleware from '../middleware/auth';
import AuthResolver from '../services/auth/AuthResolver';

export default function initializeImapRoutes(
  authResolver: AuthResolver,
  miningSources: MiningSources
) {
  const router = Router();

  const { getImapBoxes } = initializeImapController(miningSources);

  router.post('/boxes', initializeAuthMiddleware(authResolver), getImapBoxes);

  return router;
}
