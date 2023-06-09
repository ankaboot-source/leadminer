import { Router } from 'express';
import initializeOAuthController from '../controllers/oauth.controller';
import { AuthResolver } from '../services/auth/types';

export default function initializeOAuthRoutes(authResolver: AuthResolver) {
  const router = Router();
  const { oAuthHandler, oAuthCallbackHandler, GetOAuthProviders } =
    initializeOAuthController(authResolver);
  router.get('/authorize', oAuthHandler);
  router.get('/callback', oAuthCallbackHandler);
  router.get('/providers', GetOAuthProviders);
  return router;
}
