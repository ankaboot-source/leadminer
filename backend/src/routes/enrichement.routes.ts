import { Router } from 'express';
import Redis from 'ioredis';
import initializeAuthMiddleware from '../middleware/auth';
import AuthResolver from '../services/auth/AuthResolver';
import initializeEnrichementController from '../controllers/enrichement.controller';
import { Users } from '../db/interfaces/Users';

export default function initializeEnrichementRoutes(
  userResolver: Users,
  redisClient: Redis,
  authResolver: AuthResolver
) {
  const router = Router();

  const { enrich, webhook } = initializeEnrichementController(
    userResolver,
    redisClient
  );

  router.post('/enrich', initializeAuthMiddleware(authResolver), enrich);

  router.post('/webhook', webhook);

  return router;
}
