import { Router } from 'express';
import initializeStreamController from '../controllers/stream.controller';
import initializeAuthMiddleware from '../middleware/auth';
import AuthResolver from '../services/auth/AuthResolver';
import { MiningEngine } from '../services/tasks-manager-v2/MiningEngine';

export default function initializeStreamRouter(
  miningEngine: MiningEngine,
  authResolver: AuthResolver
) {
  const router = Router();

  const authMiddleware = initializeAuthMiddleware(authResolver);

  const { streamProgress } = initializeStreamController(miningEngine);
  router.get('/mine/:type/:id/progress/', authMiddleware, streamProgress);

  return router;
}
