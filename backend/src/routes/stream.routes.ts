import { Router } from 'express';
import initializeStreamController from '../controllers/stream.controller';
import { TasksManager } from '../services/tasks-manager/TasksManager';
import initializeAuthMiddleware from '../middleware/auth';
import { AuthResolver } from '../services/auth/types';

export default function initializeStreamRouter(
  authResolver: AuthResolver,
  tasksManager: TasksManager
) {
  const router = Router();

  // const { verifyJWTCookie } = initializeAuthMiddleware(authResolver);
  const { streamProgress } = initializeStreamController(tasksManager);

  router.get('/mine/:userId/:id/progress/', streamProgress);

  return router;
}
