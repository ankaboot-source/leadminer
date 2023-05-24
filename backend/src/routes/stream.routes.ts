import { Router } from 'express';
import initializeStreamController from '../controllers/stream.controller';
import { TasksManager } from '../services/TasksManager';

export default function initializeStreamRouter(tasksManager: TasksManager) {
  const router = Router();
  const { streamProgress } = initializeStreamController(tasksManager);

  router.get('/mine/:userid/:id/progress/', streamProgress);

  return router;
}
