import { Router } from 'express';
import AuthResolver from '../services/auth/AuthResolver';
import initializeAuthMiddleware from '../middleware/auth';
import initializeEnrichmentController from '../controllers/enrichment.controller';

export default function initializeEnrichmentRoutes(authResolver: AuthResolver) {
  const router = Router();

  const {
    enrichPerson,
    enrichPersonBulk,
    enrichWebhook,
    preEnrichmentMiddleware
  } = initializeEnrichmentController();

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
