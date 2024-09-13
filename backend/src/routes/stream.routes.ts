import { Router } from 'express';
import initializeStreamController from '../controllers/stream.controller';
import initializeAuthMiddleware from '../middleware/auth';
import AuthResolver from '../services/auth/AuthResolver';
import TasksManager from '../services/tasks-manager/TasksManager';

export default function initializeStreamRouter(
  tasksManager: TasksManager,
  authResolver: AuthResolver
) {
  const router = Router();

  const authMiddleware = initializeAuthMiddleware(authResolver);

  const { streamProgress } = initializeStreamController(tasksManager);
  router.get('/mine/:id/progress/', authMiddleware, streamProgress);

  return router;
}
