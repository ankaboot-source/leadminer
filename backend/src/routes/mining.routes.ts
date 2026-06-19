import { Router } from 'express';
import initializeMiningController, {
  MiningControllerDeps
} from '../controllers/mining.controller';
import { Contacts } from '../db/interfaces/Contacts';
import { MiningSources } from '../db/interfaces/MiningSources';
import initializeAuthMiddleware from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  startMiningSchema,
  startMiningFileSchema,
  startMiningPSTSchema,
  stopMiningTaskSchema,
  createImapMiningSourceSchema
} from '../validators/mining.schema';
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
    createImapMiningSource
  } = initializeMiningController(
    miningSources,
    contactsDB,
    miningEngine,
    miningControllerDeps
  );

  const authMiddleware = initializeAuthMiddleware(authResolver);

  router.post(
    '/mine/sources/imap',
    authMiddleware,
    validate(createImapMiningSourceSchema),
    createImapMiningSource
  );

  router.get('/mine/:userId/', authMiddleware, getMiningTask);
  router.post(
    '/mine/email/:userId',
    authMiddleware,
    validate(startMiningSchema),
    startMining
  );
  router.post(
    '/mine/file/:userId',
    authMiddleware,
    validate(startMiningFileSchema),
    startMiningFile
  );
  router.post(
    '/mine/pst/:userId',
    authMiddleware,
    validate(startMiningPSTSchema),
    startMiningPST
  );
  router.post(
    '/mine/:type/:userId/:id',
    authMiddleware,
    validate(stopMiningTaskSchema),
    stopMiningTask
  );

  return router;
}
