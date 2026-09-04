import { Router } from 'express';
import rateLimit from 'express-rate-limit';
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

  const imapLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10
  });

  router.post(
    '/boxes',
    initializeAuthMiddleware(authResolver),
    imapLimiter,
    getImapBoxes
  );

  return router;
}
