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

  const {
    enrichPerson,
    enrichPersonBulk,
    enrichWebhook,
    preEnrichmentMiddleware
  } = initializeEnrichmentController(userResolver);

  router.post(
    '/person',
    initializeAuthMiddleware(authResolver),
    preEnrichmentMiddleware,
    enrichPerson
  );

  router.post(
    '/person/bulk',
    initializeAuthMiddleware(authResolver),
    preEnrichmentMiddleware,
    enrichPersonBulk
  );

  router.post('/webhook/:id', enrichWebhook);

  return router;
}
