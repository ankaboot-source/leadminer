import { Router } from 'express';
import initializeOAuthController from '../controllers/oauth.controller';
import { OAuthUsers } from '../db/OAuthUsers';

export default function initializeOAuthRoutes(oAuthUsers: OAuthUsers) {
  const router = Router();
  const { oAuthHandler, oAuthCallbackHandler, GetOAuthProviders } =
    initializeOAuthController(oAuthUsers);
  router.get('/authorize', oAuthHandler);
  router.get('/callback', oAuthCallbackHandler);
  router.get('/providers', GetOAuthProviders);
  return router;
}
