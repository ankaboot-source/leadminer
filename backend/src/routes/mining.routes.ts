import { Router } from 'express';
import initializeMiningController from '../controllers/mining.controller';
import { MiningSources } from '../db/interfaces/MiningSources';
import initializeAuthMiddleware from '../middleware/auth';
import AuthResolver from '../services/auth/AuthResolver';
import TasksManager from '../services/tasks-manager/TasksManager';
import { Users } from '../db/interfaces/Users';

export default function initializeMiningRoutes(
  tasksManager: TasksManager,
  miningSource: MiningSources,
  authResolver: AuthResolver,
  userResolver: Users
) {
  const router = Router();

  const {
    startMining,
    stopMiningTask,
    getMiningTask,
    createAzureMiningSource,
    createAzureMiningSourceCallback,
    createGoogleMiningSource,
    createGoogleMiningSourceCallback,
    createImapMiningSource,
    getMiningSources
  } = initializeMiningController(tasksManager, miningSource, userResolver);

  const authMiddleware = initializeAuthMiddleware(authResolver);

  router.get('/mine/sources', authMiddleware, getMiningSources);

  router.post('/mine/sources/google', authMiddleware, createGoogleMiningSource);
  router.get('/mine/sources/google/callback', createGoogleMiningSourceCallback);

  router.post('/mine/sources/imap', authMiddleware, createImapMiningSource);

  router.post('/mine/sources/azure', authMiddleware, createAzureMiningSource);
  router.get('/mine/sources/azure/callback', createAzureMiningSourceCallback);

  router.post('/mine/:userId', authMiddleware, startMining);
  router.get('/mine/:userId/:id', authMiddleware, getMiningTask);
  router.delete('/mine/:userId/:id', authMiddleware, stopMiningTask);

  return router;
}
