import { Router } from 'express';
import initializeMiningController, {
  MiningControllerDeps
} from '../controllers/mining.controller';
import { Contacts } from '../db/interfaces/Contacts';
import { MiningSources } from '../db/interfaces/MiningSources';
import initializeAuthMiddleware from '../middleware/auth';
import AuthResolver from '../services/auth/AuthResolver';
import { MiningEngine } from '../services/tasks-manager-v2/MiningEngine';

export default function initializeMiningRoutes(
  miningEngine: MiningEngine,
  miningSources: MiningSources,
  authResolver: AuthResolver,
  contactsDB: Contacts,
  miningControllerDeps: MiningControllerDeps
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
    miningSources,
    contactsDB,
    miningEngine,
    miningControllerDeps
  );

  const authMiddleware = initializeAuthMiddleware(authResolver);

  router.post('/mine/sources/imap', authMiddleware, createImapMiningSource);
  router.put('/mine/sources/imap', authMiddleware, createImapMiningSource);

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
