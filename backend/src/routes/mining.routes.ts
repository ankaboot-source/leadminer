import { Router } from 'express';
import initializeMiningController from '../controllers/mining.controller';
import { TasksManager } from '../services/task-manager/TasksManager';
import initializeAuthMiddleware from '../middleware/auth';
import { AuthResolver } from '../services/auth/types';

export default function initializeMiningRoutes(
  authResolver: AuthResolver,
  tasksManager: TasksManager
) {
  const router = Router();

  const { verifyJWT } = initializeAuthMiddleware(authResolver);
  const { startMining, stopMiningTask, getMiningTask } =
    initializeMiningController(tasksManager);

  router.post('/mine/:userId', verifyJWT, startMining);
  router.get('/mine/:userId/:id', verifyJWT, getMiningTask);
  router.delete('/mine/:userId/:id', verifyJWT, stopMiningTask);

  return router;
}
