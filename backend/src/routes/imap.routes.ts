import { Router } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import initializeAuthMiddleware from '../middleware/auth';
import initializeImapController from '../controllers/imap.controller';

export default function initializeImapRoutes(
  supabaseRestClient: SupabaseClient
) {
  const router = Router();
  const { verifyJWT } = initializeAuthMiddleware(supabaseRestClient);
  const { getImapBoxes, signinImap } =
    initializeImapController(supabaseRestClient);

  router.post('/login', signinImap);
  router.get('/:id/boxes', verifyJWT, getImapBoxes);

  return router;
}
