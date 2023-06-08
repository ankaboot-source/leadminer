import { Router } from 'express';
import initializeMiningController from '../controllers/mining.controller';
import { TasksManager } from '../services/TasksManager';
import initializeAuthMiddleware from '../middleware/auth';
import { AuthClient } from '../db/AuthClient';

export default function initializeMiningRoutes(
  authClient: AuthClient,
  tasksManager: TasksManager
) {
  const router = Router();

  const { verifyJWT } = initializeAuthMiddleware(authClient);
  const { startMining, stopMiningTask, getMiningTask } =
    initializeMiningController(tasksManager);

  router.post('/mine/:userId', verifyJWT, startMining);
  router.get('/mine/:userId/:id', verifyJWT, getMiningTask);
  router.delete('/mine/:userId/:id', verifyJWT, stopMiningTask);

  return router;
}
