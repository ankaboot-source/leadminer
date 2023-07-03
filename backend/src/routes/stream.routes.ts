import { Router } from 'express';
import initializeStreamController from '../controllers/stream.controller';
import TasksManager from '../services/tasks-manager/TasksManager';
// import initializeAuthMiddleware from '../middleware/auth';

export default function initializeStreamRouter(tasksManager: TasksManager) {
  const router = Router();

  const { streamProgress } = initializeStreamController(tasksManager);
  router.get('/mine/:userId/:id/progress/', streamProgress);

  return router;
}
