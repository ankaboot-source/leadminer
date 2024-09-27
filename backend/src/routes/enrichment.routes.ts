import { Router } from 'express';
import initializeAuthMiddleware from '../middleware/auth';
import AuthResolver from '../services/auth/AuthResolver';
import initializeEnrichmentController from '../controllers/enrichment.controller';
import { Users } from '../db/interfaces/Users';

export default function initializeEnrichmentRoutes(
  userResolver: Users,
  authResolver: AuthResolver
) {
  const router = Router();

  const { enrichSync, enrichAsync, webhook } =
    initializeEnrichmentController(userResolver);

  router.post('/person', initializeAuthMiddleware(authResolver), enrichSync);

  router.post(
    '/person/bulk',
    initializeAuthMiddleware(authResolver),
    enrichAsync
  );
  router.post('/webhook/:id', webhook);

  return router;
}
