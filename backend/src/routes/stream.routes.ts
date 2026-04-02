import { Router } from 'express';
import initializeStreamController from '../controllers/stream.controller';
import initializeAuthMiddleware from '../middleware/auth';
import AuthResolver from '../services/auth/AuthResolver';
import ImapTasksManager from '../services/tasks-manager/ImapTasksManager';
import FileTasksManager from '../services/tasks-manager/FileTasksManager';
import PstTasksManager from '../services/tasks-manager/PstTasksManager';

export default function initializeStreamRouter(
  tasksManager: ImapTasksManager,
  tasksManagerFile: FileTasksManager,
  tasksManagerPST: PstTasksManager,
  authResolver: AuthResolver
) {
  const router = Router();

  const authMiddleware = initializeAuthMiddleware(authResolver);

  const { streamProgress } = initializeStreamController(
    tasksManager,
    tasksManagerFile,
    tasksManagerPST
  );
  router.get('/mine/:type/:id/progress/', authMiddleware, streamProgress);

  return router;
}
