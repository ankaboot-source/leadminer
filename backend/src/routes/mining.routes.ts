import { Router } from 'express';
import initializeMiningController from '../controllers/mining.controller';
import { ImapUsers } from '../db/ImapUsers';
import { OAuthUsers } from '../db/OAuthUsers';
import { TasksManager } from '../services/TasksManager';

export default function initializeMiningRoutes(
  oAuthUsers: OAuthUsers,
  imapUsers: ImapUsers,
  tasksManager: TasksManager
) {
  const router = Router();

  const { startMining, stopMiningTask, getMiningTask } =
    initializeMiningController(oAuthUsers, imapUsers, tasksManager);

  router.post('/mine/:userid', startMining);
  router.get('/mine/:userid/:id', getMiningTask);
  router.delete('/mine/:userid/:id', stopMiningTask);

  return router;
}
