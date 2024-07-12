import { Router } from 'express';
import initializeAuthMiddleware from '../middleware/auth';
import AuthResolver from '../services/auth/AuthResolver';
import initializeEnrichementController from '../controllers/enrichement.controller';
import { Users } from '../db/interfaces/Users';

export default function initializeEnrichementRoutes(
  userResolver: Users,
  authResolver: AuthResolver
) {
  const router = Router();

  const { enrich, webhook } = initializeEnrichementController(userResolver);

  router.post('/enrichAsync', initializeAuthMiddleware(authResolver), enrich);
  router.post('/webhook/:id', webhook);

  return router;
}
