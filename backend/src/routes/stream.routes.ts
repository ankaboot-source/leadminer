import { Router } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import initializeStreamController from '../controllers/stream.controller';
import { TasksManager } from '../services/TasksManager';
import initializeAuthMiddleware from '../middleware/auth';

export default function initializeStreamRouter(
  supabaseRestClient: SupabaseClient,
  tasksManager: TasksManager
) {
  const router = Router();

  const { verifyJWTCookie } = initializeAuthMiddleware(supabaseRestClient);
  const { streamProgress } = initializeStreamController(tasksManager);

  router.get('/mine/:userid/:id/progress/', verifyJWTCookie, streamProgress);

  return router;
}
