import { Router } from 'express';
import initializeAuthMiddleware from '../middleware/auth';
import AuthResolver from '../services/auth/AuthResolver';
import initializeEnrichmentController from '../controllers/enrichment.controller';

export default function initializeEnrichmentRoutes(authResolver: AuthResolver) {
  const router = Router();

  const { enrich, webhook } = initializeEnrichmentController();

  router.post('/enrichAsync', initializeAuthMiddleware(authResolver), enrich);
  router.post('/webhook/:id', webhook);

  return router;
}
