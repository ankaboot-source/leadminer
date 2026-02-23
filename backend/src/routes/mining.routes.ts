import { Router } from 'express';
import initializeMiningController from '../controllers/mining.controller';
import { Contacts } from '../db/interfaces/Contacts';
import { MiningSources } from '../db/interfaces/MiningSources';
import initializeAuthMiddleware from '../middleware/auth';
import AuthResolver from '../services/auth/AuthResolver';
import TasksManagerFile from '../services/tasks-manager/TaskManagerFile';
import TasksManager from '../services/tasks-manager/TasksManager';
import TasksManagerPST from '../services/tasks-manager/TasksManagerPST';

export default function initializeMiningRoutes(
  tasksManager: TasksManager,
  tasksManagerFile: TasksManagerFile,
  tasksManagerPST: TasksManagerPST,
  miningSource: MiningSources,
  authResolver: AuthResolver,
  contactsDB: Contacts
) {
  const router = Router();

  const {
    startMining,
    startMiningFile,
    startMiningPST,
    stopMiningTask,
    getMiningTask,
    createProviderMiningSource,
    createProviderMiningSourceCallback,
    createImapMiningSource
  } = initializeMiningController(
    tasksManager,
    tasksManagerFile,
    tasksManagerPST,
    miningSource,
    contactsDB
  );

  const authMiddleware = initializeAuthMiddleware(authResolver);

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

  router.get('/mine/:userId/', authMiddleware, getMiningTask);
  router.post('/mine/email/:userId', authMiddleware, startMining);
  router.post('/mine/file/:userId', authMiddleware, startMiningFile);
  router.post('/mine/pst/:userId', authMiddleware, startMiningPST);
  router.post('/mine/:type/:userId/:id', authMiddleware, stopMiningTask);

  return router;
}
