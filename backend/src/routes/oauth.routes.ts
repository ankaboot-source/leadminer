import { Router } from 'express';
import initializeOAuthController from '../controllers/oauth.controller';
import { OAuthUsers } from '../db/OAuthUsers';

export default function initializeOAuthRoutes(oAuthUsers: OAuthUsers) {
  const router = Router();
  const { oauthHandler, oauthCallbackHandler, GetOauthProviders } =
    initializeOAuthController(oAuthUsers);
  router.get('/authorize', oauthHandler);
  router.get('/callback', oauthCallbackHandler);
  router.get('/providers', GetOauthProviders);
  return router;
}
