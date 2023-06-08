import { Router } from 'express';
import initializeStreamController from '../controllers/stream.controller';
import { TasksManager } from '../services/TasksManager';
import initializeAuthMiddleware from '../middleware/auth';
import { AuthClient } from '../db/AuthClient';

export default function initializeStreamRouter(
  authClient: AuthClient,
  tasksManager: TasksManager
) {
  const router = Router();

  const { verifyJWTCookie } = initializeAuthMiddleware(authClient);
  const { streamProgress } = initializeStreamController(tasksManager);

  router.get('/mine/:userId/:id/progress/', verifyJWTCookie, streamProgress);

  return router;
}
