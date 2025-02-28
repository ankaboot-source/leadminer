import { Router } from 'express';
import initializeMiningController from '../controllers/mining.controller';
import { MiningSources } from '../db/interfaces/MiningSources';
import initializeAuthMiddleware from '../middleware/auth';
import AuthResolver from '../services/auth/AuthResolver';
import TasksManager from '../services/tasks-manager/TasksManager';
import TasksManagerFile from '../services/tasks-manager/TaskManagerFile';

export default function initializeMiningRoutes(
  tasksManager: TasksManager,
  tasksManagerFile: TasksManagerFile,
  miningSource: MiningSources,
  authResolver: AuthResolver
) {
  const router = Router();

  const {
    startMining,
    startMiningFile,
    stopMiningTask,
    getMiningTask,
    createProviderMiningSource,
    createProviderMiningSourceCallback,
    createImapMiningSource,
    getMiningSources
  } = initializeMiningController(tasksManager, tasksManagerFile, miningSource);

  const authMiddleware = initializeAuthMiddleware(authResolver);

  router.get('/mine/sources', authMiddleware, getMiningSources);

  router.post('/mine/sources/imap', authMiddleware, createImapMiningSource);

  router.post(
    '/mine/sources/:provider',
    authMiddleware,
    createProviderMiningSource
  );
  router.get(
    '/mine/sources/:provider/callback',
    createProviderMiningSourceCallback
  );

  router.post('/mine/email/:userId', authMiddleware, startMining);
  router.post('/mine/file/:userId', authMiddleware, startMiningFile);
  router.get('/mine/:type/:userId/:id', authMiddleware, getMiningTask);
  router.post('/mine/:type/:userId/:id', authMiddleware, stopMiningTask);

  return router;
}
