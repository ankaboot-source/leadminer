import { Router } from 'express';
import initializeStreamController from '../controllers/stream.controller';
import initializeAuthMiddleware from '../middleware/auth';
import AuthResolver from '../services/auth/AuthResolver';
import TasksManager from '../services/tasks-manager/TasksManager';
import TasksManagerFile from '../services/tasks-manager/TaskManagerFile';

export default function initializeStreamRouter(
  tasksManager: TasksManager,
  tasksManagerFile: TasksManagerFile,
  authResolver: AuthResolver
) {
  const router = Router();

  const authMiddleware = initializeAuthMiddleware(authResolver);

  const { streamProgress } = initializeStreamController(
    tasksManager,
    tasksManagerFile
  );
  router.get('/mine/:type/:id/progress/', authMiddleware, streamProgress);

  return router;
}
