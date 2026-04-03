import { Router } from 'express';
import initializePostgresqlController from '../controllers/postgresql.controller';
import initializeMiningController from '../controllers/mining.controller';
import { Contacts } from '../db/interfaces/Contacts';
import { MiningSources } from '../db/interfaces/MiningSources';
import initializeAuthMiddleware from '../middleware/auth';
import AuthResolver from '../services/auth/AuthResolver';
import TasksManager from '../services/tasks-manager/TasksManager';
import TasksManagerFile from '../services/tasks-manager/TasksManagerFile';
import TasksManagerPostgreSQL from '../services/tasks-manager/TasksManagerPostgreSQL';
import TasksManagerPST from '../services/tasks-manager/TasksManagerPST';

export default function initializeMiningRoutes(
  tasksManager: TasksManager,
  tasksManagerFile: TasksManagerFile,
  tasksManagerPST: TasksManagerPST,
  tasksManagerPostgreSQL: TasksManagerPostgreSQL,
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

  // Initialize PostgreSQL controller
  const postgresqlController = initializePostgresqlController(miningSource);

  // PostgreSQL routes
  router.post(
    '/mine/sources/postgresql/test',
    authMiddleware,
    postgresqlController.testConnection
  );
  router.post(
    '/mine/postgresql/preview',
    authMiddleware,
    postgresqlController.previewQuery
  );
  router.post(
    '/mine/postgresql/tables',
    authMiddleware,
    postgresqlController.listTables
  );
  router.post(
    '/mine/postgresql/:userId',
    authMiddleware,
    postgresqlController.startMining
  );

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
