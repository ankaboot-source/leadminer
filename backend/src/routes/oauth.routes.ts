import { Router } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import initializeOAuthController from '../controllers/oauth.controller';

export default function initializeOAuthRoutes(
  supabaseRestClient: SupabaseClient
) {
  const router = Router();
  const { oAuthHandler, oAuthCallbackHandler, GetOAuthProviders } =
    initializeOAuthController(supabaseRestClient);
  router.get('/authorize', oAuthHandler);
  router.get('/callback', oAuthCallbackHandler);
  router.get('/providers', GetOAuthProviders);
  return router;
}
