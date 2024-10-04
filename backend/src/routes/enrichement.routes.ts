import { Router } from 'express';
import initializeAuthMiddleware from '../middleware/auth';
import AuthResolver from '../services/auth/AuthResolver';
import initializeEnrichementController from '../controllers/enrichement.controller';

export default function initializeEnrichementRoutes(
  authResolver: AuthResolver
) {
  const router = Router();

  const { enrich, webhook } = initializeEnrichementController();

  router.post('/enrichAsync', initializeAuthMiddleware(authResolver), enrich);
  router.post('/webhook/:id', webhook);

  return router;
}
