import { Router } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import initializeMiningController from '../controllers/mining.controller';
import { TasksManager } from '../services/TasksManager';
import initializeAuthMiddleware from '../middleware/auth';

export default function initializeMiningRoutes(
  supabaseRestClient: SupabaseClient,
  tasksManager: TasksManager
) {
  const router = Router();

  const { verifyJWT } = initializeAuthMiddleware(supabaseRestClient);
  const { startMining, stopMiningTask, getMiningTask } =
    initializeMiningController(tasksManager);

  router.post('/mine/:userid', verifyJWT, startMining);
  router.get('/mine/:userid/:id', verifyJWT, getMiningTask);
  router.delete('/mine/:userid/:id', verifyJWT, stopMiningTask);

  return router;
}
