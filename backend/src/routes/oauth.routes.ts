import { Router } from 'express';
import initializeOAuthController from '../controllers/oauth.controller';
import { AuthClient } from '../db/AuthClient';

export default function initializeOAuthRoutes(authClient: AuthClient) {
  const router = Router();
  const { oAuthHandler, oAuthCallbackHandler, GetOAuthProviders } =
    initializeOAuthController(authClient);
  router.get('/authorize', oAuthHandler);
  router.get('/callback', oAuthCallbackHandler);
  router.get('/providers', GetOAuthProviders);
  return router;
}
