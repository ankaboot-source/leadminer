import { Router } from 'express';
import {
  oauthCallbackHandler,
  GetOauthProviders,
  oauthHandler
} from '../controllers/oauth.controller';

const router = Router();

router.get('/oauth/authorize', oauthHandler);
router.get('/oauth/callback', oauthCallbackHandler);
router.get('/oauth/providers', GetOauthProviders);
export default router;
